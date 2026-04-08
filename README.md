# sequelize-cursor-pagination

[GraphQL-ready cursor pagination](https://graphql.org/learn/pagination/) for Sequelize.

This library provides a simple function, `sequelizeFindByCursor`, that you can use to paginate SQL queries using `after`, `before`, `first`, and `last` instead of `limit` & `offset`.

Includes efficient built-in support for `hasNextPage` & `hasPreviousPage`.

This library has been designed with the [GraphQL Cursor Connections Specification](https://relay.dev/graphql/connections.htm) in mind, but can likely be used for any cursor pagination (including REST).

## Install

[`npm i @ephys/sequelize-cursor-pagination`](https://www.npmjs.com/package/@ephys/sequelize-cursor-pagination)

TypeScript typings are built-in.

## Usage

The simplest usage is to select the first `x` elements from the table in a given sort order.

```typescript
const results: FindByCursorResult = sequelizeFindByCursor({
  model: UserModel,
  // you can also use 'last'
  first: 10,
  order: [
    ['firstName', 'ASC'],
    ['lastName', 'ASC'],
  ],
});
```

This will return an object matching the following shape:

```typescript
type FindByCursorResult = {
  getNodes: () => Promise<UserModel[]>;

  // The sorted list of field names that must be present in the cursor object.
  cursorKeys: string[];

  // Returns whether there are records after & before the current page, respectively.
  // These methods are meant to be used at the same time as getNodes(),
  // and share the same database query when possible.
  hasNextPage: () => Promise<boolean>;
  hasPreviousPage: () => Promise<boolean>;

  // Returns the total number of records matching the base `where` filter,
  getTotalCount: () => Promise<number>;
};
```

### Cursor

In order to select the next page of your pagination, you need to pass a cursor to `sequelizeFindByCursor`.

These cursors are stateless and must be an object which includes the primary key + every value used in the sort order.

In the following example, the sort order uses `firstName` and `lastName` and the table has `id` as the sole primary key. Therefore the
cursor will be an object with the shape `{ firstName: string, lastName: string, id: number }`.

You can use the `cursorKeys` field of the result to know exactly which fields are required in the cursor:

```typescript
const results = sequelizeFindByCursor({
  model: UserModel,
  first: 10,
  order: [['firstName', 'ASC']],
});

console.log(results.cursorKeys); // ["firstName", "id"] (note: include a unique column to avoid exposing the primary key if you don't want to expose it)
```

It is up to you to build the cursor and to determine how the cursor will be stored for the next query.  
You could:

- Serialize it and send it with the query response (beware of data leaks).
- Store it somewhere and send the cursor ID (making it a stateful cursor).
- If your database data is immutable, you could simply send a unique field of the entity as the cursor,
  and rebuild the cursor from the entity before calling `sequelizeFindByCursor`. \
  If your data is not immutable this may cause problems with your pagination.
  (If the last user of a page changes their name from Bertrand to Zoe, your user will end up at the end of your list)

```typescript
const results: FindByCursorResult = sequelizeFindByCursor({
  model: UserModel,
  first: 10,
  // you can also use 'before' (you would typically use 'before' with 'last')
  after: {
    id: 6,
    firstName: 'Bernard',
    lastName: '',
  },
  order: [
    ['firstName', 'ASC'],
    ['lastName', 'ASC'],
  ],
});
```

### Offset

The `offset` option lets you skip a number of items from the start of the cursor-filtered result set (when using `first`) or from the end (when using `last`). It defaults to `0` and can be combined with `after` or `before`.

```typescript
// Skip the first 5 results, then return the next 10
const results = sequelizeFindByCursor({
  model: UserModel,
  first: 10,
  offset: 5,
  order: [['firstName', 'ASC']],
});

// When offset > 0, hasPreviousPage() is always true (items were skipped at the start)
console.log(await results.hasPreviousPage()); // true
```

```typescript
// Combined with a cursor: skip 1 item after the cursor, then return the next 2
const results = sequelizeFindByCursor({
  model: UserModel,
  first: 2,
  offset: 1,
  after: { id: 3, firstName: 'Cedric', lastName: 'Anderson' },
  order: [
    ['firstName', 'ASC'],
    ['lastName', 'ASC'],
  ],
});
```

### Total Count

The `getTotalCount()` method returns the total number of records that match the base `where` filter, **ignoring** any cursor (`after`/`before`) and pagination (`first`/`last`/`offset`). This is useful for building "Page 1 of N" style UIs.

```typescript
const results = sequelizeFindByCursor({
  model: UserModel,
  first: 10,
  after: { id: 6, firstName: 'Bernard', lastName: '' },
  where: { isActive: true },
  order: [['firstName', 'ASC']],
});

console.log((await results.getNodes()).length); // up to 10 (cursor-filtered page)
console.log(await results.getTotalCount()); // total active users, regardless of cursor
```

### Options

`sequelizeFindByCursor` supports a series of standard sequelize options such as:

- `transaction`
- `logging`
- `where`
- `attributes`
- `offset` — skip N items from the start (with `first`) or the end (with `last`) of the cursor-filtered set

Check the typescript typings for more.

### Customising the query

If the available options are not enough, you can use the escape hatch to build the query yourself.
It should be used as a last resort.

```typescript
const results: FindByCursorResult = sequelizeFindByCursor({
  model: UserModel,
  first: 10,
  order: [
    ['firstName', 'ASC'],
    ['lastName', 'ASC'],
  ],
  findAll: (query) => {
    // customise `query` before passing it to findAll.
    // or use sequelize.query() to run a hand-written sql query.
    return UserModel.findAll(query);
  },
});
```
