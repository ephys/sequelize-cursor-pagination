import type {
  Model,
  ModelCtor as ModelClass,
  FindOptions,
  OrderItem as SequelizeOrderItem,
  Logging,
  Transactionable,
  Projectable,
  Filterable,
} from 'sequelize';
import {
  Sequelize,
  Op,
} from 'sequelize';
import { getPrimaryColumns, getUniqueColumns, matchAssociationReference } from './sequelize-utils';
import type { MaybePromise } from './types';

/**
 * @module sequelize-find-by-cursor
 *
 * A sequelize implementation of cursor-based pagination (find after or before another entity).
 *
 * Based on
 * @link https://facebook.github.io/relay/graphql/connections.htm
 */

export type ModelFinder<E> = (query) => Promise<E[]>;

export type OrderTuple = [string, 'ASC' | 'DESC'];

type Cursor = { [key: string]: any };

interface IDownPassed extends Logging, Transactionable, Projectable, Filterable<any> {}

interface QueryMetadata<Entity extends Model> {
  isLast: boolean;
  limit: number;

  sortOrder: OrderTuple[];

  after: Cursor | null;
  before: Cursor | null;

  findAll: ModelFinder<Entity>;

  passDown: IDownPassed;
}

export interface FindByCursorConfig<E extends Model> extends IDownPassed {
  model: ModelClass<E>;
  order: OrderTuple[];

  /**
   * This is a cursor. If provided, only entities that are located before this cursor will be returned.
   *
   * The cursor is an object that must contain one value for each column used in the `order` property, plus the primary keys of the entity.
   */
  before?: { [key: string]: any } | null;

  /**
   * This is a cursor. If provided, only entities that are located after this cursor will be returned.
   *
   * The cursor is an object that must contain one value for each column used in the `order` property, plus the primary keys of the entity.
   */
  after?: { [key: string]: any } | null;
  first?: number | null;
  last?: number | null;

  /**
   * Use this to customise the query for your own needs if the provided options are not sufficient.
   * This option should be used as a last resort.
   */
  findAll?: ModelFinder<E>;
}

export interface FindByCursorResult<T> {
  nodes: T[];
  hasNextPage(): MaybePromise<boolean>;
  hasPreviousPage(): MaybePromise<boolean>;
  cursorKeys: string[];
}

export async function sequelizeFindByCursor<Entity extends Model>(
  config: FindByCursorConfig<Entity>,
): Promise<FindByCursorResult<Entity>> {

  const {
    model, order, after, before, first, last,
    findAll = (async query => config.model.findAll(query)),
    ...passDown
  } = config;

  if (!Array.isArray(order) || order.length === 0) {
    throw new Error(`'order' must be specified (and an Array)`);
  }

  if (after && before) {
    // TODO
    throw new Error(`Having both 'before' and 'after' is not currently supported. PR welcome.`);
  }

  if (first != null && last != null) {
    throw new Error(`Having both 'first' and 'last' is not supported.`);
  }

  const limit = first || last;
  if (!Number.isSafeInteger(limit)) {
    throw new Error(`'first' and 'last' must be safe integers, and one of them must be provided.`);
  }

  if (limit < 0) {
    throw new Error(`'first' and 'last' cannot be < 0`);
  }

  const primaryKeys: string[] = getPrimaryColumns(model)
    // sort by db name to ensure they are in the same order between restarts
    .sort((c1, c2) => c1.field.localeCompare(c2.field))
    // @ts-expect-error
    .map(col => col.fieldName);

  const uniques: string[][] = [
    primaryKeys,
    // @ts-expect-error
    ...getUniqueColumns(model).map(composite => composite.map(col => col.fieldName)),
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

  const queryMetadata: QueryMetadata<Entity> = {
    isLast: last != null,
    limit,
    sortOrder,
    after,
    before,
    findAll,
    passDown,
  };

  const { nodes, hasMoreNodes } = await getPage<Entity>(queryMetadata);

  return {
    nodes,
    hasNextPage: () => hasNextPage(queryMetadata, hasMoreNodes),
    hasPreviousPage: () => hasPreviousPage(queryMetadata, hasMoreNodes),
    cursorKeys: sortOrder.map(tuple => tuple[0]),
  };
}

function sortOrderIncludesUnique(order: OrderTuple[], compositeUniques: string[][]): boolean {
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
  return order.find(tuple => tuple[0] === field) != null;
}

/*
  hasPreviousPage is used to indicate whether more edges exist prior to the set defined by the clients arguments.

  1. If last is set:
    a. Let edges be the result of calling ApplyCursorsToEdges(allEdges, before, after).
    b. If edges contains more than last elements return true, otherwise false.
  2. If after is set:
    a. If the server can efficiently determine that elements exist prior to after, return true.
  3. Return false.
*/
function hasPreviousPage(queryMetadata, hasMoreNodes) {

  if (queryMetadata.isLast) {
    return hasMoreNodes;
  }

  if (queryMetadata.after) {
    return getPage({
      ...queryMetadata,

      before: queryMetadata.after,
      isLast: true,

      sortOrder: queryMetadata.sortOrder,
      after: null,

      // we take 0 items because getPage will by default take 1 more
      // for hasMoreNodes
      limit: 0,
    }).then(results => results.hasMoreNodes);
  }

  return false;
}

/*
  hasNextPage is used to indicate whether more edges exist following the set defined by the clients arguments.

  1. If first is set:
    a. Let edges be the result of calling ApplyCursorsToEdges(allEdges, before, after).
    b. If edges contains more than first elements return true, otherwise false.
  2. If before is set:
    a. If the server can efficiently determine that elements exist following before, return true.
  3. Return false.
*/
function hasNextPage(queryMetadata, hasMoreNodes) {

  if (!queryMetadata.isLast) {
    return hasMoreNodes;
  }

  if (queryMetadata.before) {
    return getPage({
      ...queryMetadata,
      after: queryMetadata.before,
      isLast: false,

      sortOrder: queryMetadata.sortOrder,
      before: null,

      // we take 0 items because getPage will by default take 1 more
      // for hasMoreNodes
      limit: 0,
    }).then(results => {
      return results.hasMoreNodes;
    });
  }

  return false;
}

function reverseOrder(order) {
  if (!order) {
    return order;
  }

  return order.map(orderPart => {
    const direction = orderPart[1] === 'ASC' ? 'DESC' : 'ASC';

    return [orderPart[0], direction];
  });
}

enum CursorType {
  AFTER = 0,
  BEFORE = 1,
}

async function getPage<Entity extends Model>(
  queryMetadata: QueryMetadata<Entity>,
): Promise<{ nodes: Entity[], hasMoreNodes: boolean }> {

  const { sortOrder, after, before, isLast, findAll, passDown } = queryMetadata;

  const queryOrder = orderTupleToSequelizeOrder(isLast ? reverseOrder(sortOrder) : sortOrder);
  const query: FindOptions = {
    ...passDown, // Transactionable & Logging
    limit: queryMetadata.limit,
    order: queryOrder,

    // subqueries are not compatible with referencing a joined table in `order`
    // TODO: This should be fixed in Sequelize, need a bug report
    // @ts-expect-error
    subQuery: queryOrder.find(item => item.length === 3) == null,
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
    // @ts-expect-error
    query.where = wheres.length === 1 ? wheres[0] : Sequelize.and(...wheres);
  }

  // get one more result than needed to check if there are still results after this
  query.limit += 1;

  const currentPageResults: Entity[] = await findAll(query);

  if (queryMetadata.isLast) {
    currentPageResults.reverse();
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

function buildOrderQuery(orderBy: OrderTuple[], cursor: Cursor, cursorType: CursorType) {
  const operators = cursorType === CursorType.AFTER ? {
    ASC: Op.gt,
    DESC: Op.lt,
  } : {
    ASC: Op.lt,
    DESC: Op.gt,
  };

  let orderQuery;

  // we build the sort order from the inside out (starting with the last item, to the first)
  {
    // very last item: orderQuery = pk > after.pk
    const lastSortEntry = orderBy[orderBy.length - 1];
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
    const [sortColumn, orderDirection]: [string, string] = orderBy[i];
    const operator = operators[orderDirection];

    if (!(sortColumn in cursor)) {
      throw new Error(`cursor is missing key ${sortColumn}`);
    }

    // orderQuery
    orderQuery = Sequelize.or(
      { [sortColumn]: { [operator]: cursor[sortColumn] } },
      // @ts-expect-error
      Sequelize.and(
        { [sortColumn]: cursor[sortColumn] },
        orderQuery,
      ),
    );
  }

  return orderQuery;
}

// TODO: PR sequelize to support $association.column$ in `order` as they already support it in `where`
export function orderTupleToSequelizeOrder(orders: OrderTuple[]): SequelizeOrderItem[] {
  return orders.map(order => {
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
