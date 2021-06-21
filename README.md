# sequelize-cursor-pagination

[GraphQL-ready cursor pagination](https://graphql.org/learn/pagination/) for Sequelize.

This library provides a simple function, `sequelizeFindByCursor`, that you can use to paginate SQL queries using `after`, `before`, `first`, and `last` instead of `limit` & `offset`.

Includes efficient built-in support for `hasNextPage` & `hasPreviousPage`.

This library has been designed with the [GraphQL Cursor Connections Specification](https://relay.dev/graphql/connections.htm) in mind, but can likely be used for any cursor pagination (including REST).

## Install

`npm i @ephys/sequelize-cursor-pagination`

TypeScript typings are built-in.

## Usage

The simplest usage is to select the first `x` elements from the table in a given sort order. 

```typescript
const results: FindByCursorResult = await sequelizeFindByCursor({
  model: UserModel,
  // you can also use 'last'
  first: 10,
  order: [['firstName', 'ASC'], ['lastName', 'ASC']],
});
```

This will return an object matching the following shape: 

```typescript
type FindByCursorResult = {
  nodes: UserModel[],
  
  // these functions will sometimes return a Promise based on
  // whether or not the value can be determined without making a new Query.
  // In the above example, hasNextPage() will not return a promise because it already knows
  // whether or not there is more data to be selected. It does this by selecting one more item than needed.
  hasNextPage: () => MaybePromise<boolean>,
  hasPreviousPage: () => MaybePromise<boolean>,
} 
```

### Cursor

In order to select the next page of your pagination, you need to pass a cursor to `sequelizeFindByCursor`.

These cursors are stateless and must be an object which includes the primary key + every value used in the sort order.

In the following example, the sort order uses `firstName` and `lastName` and the table has `id` as the sole primary key. Therefore the 
cursor will be an object with the shape `{ firstName: string, lastName: string, id: number }`.

It is up to you to build the cursor and to determine how the cursor will be stored for the next query.  
You could:
- Serialize it and send it with the query response (beware of data leaks).
- Store it somewhere and send the cursor ID (making it a stateful cursor).
- If your database data is immutable, you could simply send a unique field of the entity as the cursor, 
  and rebuild the cursor from the entity before calling `sequelizeFindByCursor`. \
  If your data is not immutable this may cause problems with your pagination. 
  (If the last user of a page changes their name from Bertrand to Zoe, your user will end up at the end of your list)

```typescript
const results: FindByCursorResult = await sequelizeFindByCursor({
  model: UserModel,
  first: 10,
  // you can also use 'before' (you would typically use 'before' with 'last')
  after: {
    id: 6,
    firstName: 'Bernard',
    lastName: '',
  },
  order: [['firstName', 'ASC'], ['lastName', 'ASC']],
});
```

### Options

`sequelizeFindByCursor` supports a series of standard sequelize options such as:

- `transaction`
- `logging`
- `where`
- `attributes`

Check the typescript typings for more.

### Customising the query

If the available options are not enough, you can use the escape hatch to build the query yourself. 
It should be used as a last resort.

```typescript
const results: FindByCursorResult = await sequelizeFindByCursor({
  model: UserModel,
  first: 10,
  order: [['firstName', 'ASC'], ['lastName', 'ASC']],
  findAll: query => {
    // customise `query` before passing it to findAll.
    // or use sequelize.query() to run a hand-written sql query.
    return UserModel.findAll(query);
  },
});
```
