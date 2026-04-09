import type {
  Model,
  ModelStatic,
  FindOptions,
  OrderItem as SequelizeOrderItem,
  Logging,
  Transactionable,
  Projectable,
  Filterable,
} from '@sequelize/core';
import { Op, and, or } from '@sequelize/core';
import {
  getPrimaryAttributes,
  getUniqueColumns,
  matchAssociationReference,
} from './sequelize-utils.js';

/**
 * @module sequelize-find-by-cursor
 *
 * A sequelize implementation of cursor-based pagination (find after or before another entity).
 *
 * Based on
 * @link https://facebook.github.io/relay/graphql/connections.htm
 */

export type ModelFinder<E> = (query: FindOptions) => Promise<readonly E[]>;

export type OrderTuple = [string, 'ASC' | 'DESC'];

type Cursor = { [key: string]: any };

// Transactionable is intentionally excluded — transactions are specified per-method call.
interface SequelizeOptions extends Logging, Projectable, Filterable {}

interface QueryMetadata<Entity extends Model> {
  after: Cursor | null;
  before: Cursor | null;

  findAll: ModelFinder<Entity>;

  isLast: boolean;
  limit: number;
  model: ModelStatic<Entity>;
  offset: number;

  sequelizeOptions: SequelizeOptions;

  sortOrder: readonly OrderTuple[];
}

export interface SequelizePageConfig<E extends Model> extends SequelizeOptions {
  /**
   * This is a cursor. If provided, only entities that are located after this cursor will be returned.
   *
   * The cursor is an object that must contain one value for each column used in the `order` property, plus the primary keys of the entity.
   */
  after?: { [key: string]: any } | null;

  /**
   * This is a cursor. If provided, only entities that are located before this cursor will be returned.
   *
   * The cursor is an object that must contain one value for each column used in the `order` property, plus the primary keys of the entity.
   */
  before?: { [key: string]: any } | null;

  /**
   * Use this to customize the query for your own needs if the provided options are not sufficient.
   * This option should be used as a last resort.
   */
  findAll?: ModelFinder<E>;

  first?: number | null;
  last?: number | null;
  model: ModelStatic<E>;

  /**
   * Number of items to skip from the start of the cursor-filtered set.
   * Can be combined with `after` or `before`.
   * Defaults to 0.
   */
  offset?: number | null;

  order: readonly OrderTuple[];
}

export class SequelizePage<T extends Model> {
  readonly cursorKeys: readonly string[];
  readonly #queryMetadata: QueryMetadata<T>;

  #pendingPagePromise: Promise<{ hasMoreNodes: boolean; nodes: T[] }> | null =
    null;

  constructor(config: SequelizePageConfig<T>) {
    const {
      model,
      order,
      after,
      before,
      first,
      last,
      offset,
      findAll = async (query) => config.model.findAll(query),
      ...sequelizeOptions
    } = config;

    if (!Array.isArray(order) || order.length === 0) {
      throw new Error(`'order' must be specified (and an Array)`);
    }

    if (after && before) {
      throw new Error(
        `Having both 'before' and 'after' is not currently supported. PR welcome.`,
      );
    }

    if (first != null && last != null) {
      throw new Error(`Having both 'first' and 'last' is not supported.`);
    }

    const limit = first ?? last;
    if (limit == null || !Number.isSafeInteger(limit)) {
      throw new Error(
        `'first' and 'last' must be safe integers, and one of them must be provided.`,
      );
    }

    if (limit < 0) {
      throw new Error(`'first' and 'last' cannot be < 0`);
    }

    const resolvedOffset = offset ?? 0;
    if (!Number.isSafeInteger(resolvedOffset) || resolvedOffset < 0) {
      throw new Error(`'offset' must be a non-negative safe integer`);
    }

    const primaryKeys: string[] = getPrimaryAttributes(model)
      // sort by db name to ensure they are in the same order between restarts
      .sort((c1, c2) => c1.columnName.localeCompare(c2.columnName))
      .map((col) => col.attributeName);

    const uniques: string[][] = [
      primaryKeys,
      ...getUniqueColumns(model).map((composite) =>
        composite.map((col) => col.attributeName),
      ),
    ];

    // sort by PK last to ensure the [where PK] (see #getPage) always returns the elements in the same order.
    const sortOrder: OrderTuple[] = [...order];
    if (!sortOrderIncludesUnique(sortOrder, uniques)) {
      for (const primaryKey of primaryKeys) {
        if (!sortOrderHasField(sortOrder, primaryKey)) {
          sortOrder.push([primaryKey, 'ASC']);
        }
      }
    }

    const queryMetadata: QueryMetadata<T> = {
      isLast: last != null,
      limit,
      model,
      offset: resolvedOffset,
      sortOrder,
      after: after ?? null,
      before: before ?? null,
      findAll,
      sequelizeOptions,
    };

    this.cursorKeys = sortOrder.map((tuple) => tuple[0]);
    this.#queryMetadata = queryMetadata;
  }

  /**
   * Gets the current page of results, using a cached promise to dedupe multiple simultaneous calls.
   */
  async #getPageDeduped(options: Transactionable | undefined) {
    if (this.#pendingPagePromise === null) {
      this.#pendingPagePromise = Promise.resolve()
        .then(async () => getPage(this.#queryMetadata, options))
        .finally(() => {
          this.#pendingPagePromise = null;
        });
    }

    return this.#pendingPagePromise;
  }

  /**
   * Returns the nodes for the current page.
   * Loads one additional node beyond the requested limit to determine whether there is a next/previous page (see {@link hasNextPage} and {@link hasPreviousPage}),
   * but that extra node is not included in the returned results.
   *
   * Simultaneous calls to this method are deduplicated, to allow getting the nodes and page info at the same time without unnecessary duplicate queries.
   *
   * @param options.transaction - Transaction to use for this query.
   *   Note: only the first call's transaction is used; subsequent calls return the cached result.
   */
  async getNodes(options?: Transactionable): Promise<readonly T[]> {
    return this.#getPageDeduped(options).then(({ nodes }) => nodes);
  }

  /**
   * Returns whether there is a next page.
   *
   * In the forward direction (when `first` is used), this is determined by loading the nodes ({@link getNodes})
   * and checking whether the extra node loaded beyond the requested limit exists.
   * When called at the same time as `getNodes`, the node fetching is deduplicated to avoid unnecessary duplicate queries.
   *
   * In the backward direction (when `last` is used), this is determined by loading one node in the opposite direction,
   * and checking whether it exists. This is a different query from ({@link getNodes}), and is therefore not deduplicated with it.
   *
   * @param options.transaction - Transaction to use for this query.
   *   Note: only the first call's transaction is used for the main page query;
   *   subsequent calls return the cached result.
   */
  async hasNextPage(options?: Transactionable): Promise<boolean> {
    /*
      GraphQL cursor spec:
      hasNextPage is used to indicate whether more edges exist following the set defined by the clients arguments.

      1. If first is set:
        a. Let edges be the result of calling ApplyCursorsToEdges(allEdges, before, after).
        b. If edges contains more than first elements return true, otherwise false.
      2. If before is set:
        a. If the server can efficiently determine that elements exist following before, return true.
      3. Return false.
    */

    if (!this.#queryMetadata.isLast) {
      return (await this.#getPageDeduped(options)).hasMoreNodes;
    }

    // Items were skipped at the end of the cursor-filtered set
    if (this.#queryMetadata.offset > 0) {
      return true;
    }

    if (this.#queryMetadata.before) {
      return getPage(
        {
          ...this.#queryMetadata,
          after: this.#queryMetadata.before,
          isLast: false,

          sortOrder: this.#queryMetadata.sortOrder,
          before: null,

          // we take 0 items because getPage will by default take 1 more
          // for hasMoreNodes
          limit: 0,
        },
        options,
      ).then((results) => {
        return results.hasMoreNodes;
      });
    }

    return false;
  }

  /**
   * Returns whether there is a previous page.
   *
   * In the forward direction (when `first` is used), this is determined by loading one node in the opposite direction,
   * and checking whether it exists. This is a different query from ({@link getNodes}), and is therefore not deduplicated with it.
   *
   * In the backward direction (when `last` is used), this is determined by loading the nodes ({@link getNodes})
   * and checking whether the extra node loaded beyond the requested limit exists.
   * When called at the same time as `getNodes`, the node fetching is deduplicated to avoid unnecessary duplicate queries.
   *
   * @param options.transaction - Transaction to use for this query.
   *   Note: only the first call's transaction is used for the main page query;
   *   subsequent calls return the cached result.
   */
  async hasPreviousPage(options?: Transactionable): Promise<boolean> {
    /*
      GraphQL cursor spec:
      hasPreviousPage is used to indicate whether more edges exist prior to the set defined by the clients arguments.

      1. If last is set:
        a. Let edges be the result of calling ApplyCursorsToEdges(allEdges, before, after).
        b. If edges contains more than last elements return true, otherwise false.
      2. If after is set:
        a. If the server can efficiently determine that elements exist prior to after, return true.
      3. Return false.
    */

    if (this.#queryMetadata.isLast) {
      return (await this.#getPageDeduped(options)).hasMoreNodes;
    }

    // Items were skipped at the start of the cursor-filtered set
    if (this.#queryMetadata.offset > 0) {
      return true;
    }

    if (this.#queryMetadata.after) {
      return getPage(
        {
          ...this.#queryMetadata,

          before: this.#queryMetadata.after,
          isLast: true,

          sortOrder: this.#queryMetadata.sortOrder,
          after: null,

          // we take 0 items because getPage will by default take 1 more
          // for hasMoreNodes
          limit: 0,
        },
        options,
      ).then((results) => results.hasMoreNodes);
    }

    return false;
  }

  /**
   * Returns the total number of records matching the base filters (ignoring pagination).
   *
   * @param options.transaction - Transaction to use for this query.
   */
  async getTotalCount(options?: Transactionable): Promise<number> {
    return this.#queryMetadata.model.count({
      ...this.#queryMetadata.sequelizeOptions,
      ...options,
      attributes: undefined,
    });
  }
}

function sortOrderIncludesUnique(
  order: OrderTuple[],
  compositeUniques: string[][],
): boolean {
  for (const compositeUnique of compositeUniques) {
    if (sortOrderHasAllFields(order, compositeUnique)) {
      return true;
    }
  }

  return false;
}

function sortOrderHasAllFields(order: OrderTuple[], fields: string[]) {
  for (const field of fields) {
    if (!sortOrderHasField(order, field)) {
      return false;
    }
  }

  return true;
}

function sortOrderHasField(order: OrderTuple[], field: string): boolean {
  return order.some((tuple) => tuple[0] === field);
}

function reverseOrder(order: readonly OrderTuple[]): readonly OrderTuple[] {
  return order.map(
    ([column, direction]): OrderTuple => [
      column,
      direction === 'ASC' ? 'DESC' : 'ASC',
    ],
  );
}

enum CursorType {
  AFTER = 0,
  BEFORE = 1,
}

async function getPage<Entity extends Model>(
  queryMetadata: QueryMetadata<Entity>,
  options: Transactionable | undefined,
): Promise<{ hasMoreNodes: boolean; nodes: Entity[] }> {
  const { sortOrder, after, before, isLast, findAll, sequelizeOptions } = queryMetadata;

  const queryOrder = orderTupleToSequelizeOrder(
    isLast ? reverseOrder(sortOrder) : sortOrder,
  );
  const query: FindOptions = {
    ...sequelizeOptions, // Logging & Projectable & Filterable
    ...options, // Transactionable
    // get one more result than needed to check if there are still results after this page
    limit: queryMetadata.limit + 1,
    offset: queryMetadata.offset,
    order: queryOrder,

    // subqueries are not compatible with referencing a joined table in `order`
    // TODO: This should be fixed in Sequelize, need a bug report
    // @ts-expect-error -- not worth typing this as it is a temporary workaround
    subQuery: !queryOrder.some((item) => item.length === 3),
  };

  /*
   * The basic idea to implement an `after: x` in SQL is to ORDER BY the results by a set of fields
   *
   * Then filter out the rows that are before `after` by filtering on each item of the ORDER BY clause
   *
   * e.g. If order by pk ASC:
   *
   * WHERE pk > after.pk
   *
   * e.g. If order by firstName ASC, pk ASC:
   *
   * WHERE firstName > after.firstName OR (firstName = after.firstName AND pk > after.pk)
   *
   * e.g. If ordering by firstName ASC, lastName ASC, pk ASC:
   *
   * WHERE firstName > after.firstName
   *   OR (firstName = after.firstName AND (lastName > after.lastName
   *    OR (lastName = after.lastName AND pk > after.pk)))
   */

  const wheres = query.where ? [query.where] : [];

  if (after != null) {
    wheres.push(buildOrderQuery(sortOrder, after, CursorType.AFTER));
  }

  if (before != null) {
    wheres.push(buildOrderQuery(sortOrder, before, CursorType.BEFORE));
  }

  if (wheres.length > 0) {
    query.where = wheres.length === 1 ? wheres[0] : and(...wheres);
  }

  let currentPageResults: Entity[] = [...(await findAll(query))];

  if (queryMetadata.isLast) {
    currentPageResults = currentPageResults.reverse();
  }

  const hasMoreResults = currentPageResults.length === queryMetadata.limit + 1;
  if (hasMoreResults) {
    if (queryMetadata.isLast) {
      currentPageResults.shift();
    } else {
      currentPageResults.pop();
    }
  }

  return { nodes: currentPageResults, hasMoreNodes: hasMoreResults };
}

function buildOrderQuery(
  orderBy: readonly OrderTuple[],
  cursor: Cursor,
  cursorType: CursorType,
) {
  const operators =
    cursorType === CursorType.AFTER
      ? {
          ASC: Op.gt,
          DESC: Op.lt,
        }
      : {
          ASC: Op.lt,
          DESC: Op.gt,
        };

  let orderQuery;

  // we build the sort order from the inside out (starting with the last item, to the first)
  {
    // very last item: orderQuery = pk > after.pk
    const lastSortEntry = orderBy.at(-1);
    if (!lastSortEntry) {
      throw new Error('orderBy cannot be empty');
    }

    const [sortColumn, orderDirection] = lastSortEntry;

    const operator = operators[orderDirection];

    if (!(sortColumn in cursor)) {
      throw new Error(`cursor is missing key ${sortColumn}`);
    }

    orderQuery = {
      [sortColumn]: { [operator]: cursor[sortColumn] },
    };
  }

  // subsequent items:
  // orderQuery = lastName > after.lastName OR (lastName = after.lastName AND {orderQuery})
  for (let i = orderBy.length - 2; i >= 0; i--) {
    const [sortColumn, orderDirection]: OrderTuple = orderBy[i];
    const operator = operators[orderDirection];

    if (!(sortColumn in cursor)) {
      throw new Error(`cursor is missing key ${sortColumn}`);
    }

    // orderQuery
    orderQuery = or(
      { [sortColumn]: { [operator]: cursor[sortColumn] } },
      and({ [sortColumn]: cursor[sortColumn] }, orderQuery),
    );
  }

  return orderQuery;
}

// TODO: PR sequelize to support $association.column$ in `order` as we already support it in `where`
function orderTupleToSequelizeOrder(
  orders: readonly OrderTuple[],
): SequelizeOrderItem[] {
  return orders.map((order) => {
    const [column, direction] = order;

    const associationReference = matchAssociationReference(column);
    if (!associationReference) {
      return order;
    }

    return [
      /* association name */ associationReference[0],
      /* association column */ associationReference[1],
      direction,
    ];
  });
}
