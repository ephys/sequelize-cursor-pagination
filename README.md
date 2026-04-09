# sequelize-cursor-pagination

[GraphQL-ready cursor pagination](https://graphql.org/learn/pagination/) for Sequelize.

This library provides tools to build paginated queries with **cursor and/or offset pagination**,
and to easily retrieve the paginated results along with pagination metadata.

It includes efficient built-in support for `hasNextPage`, `hasPreviousPage`, and `getTotalCount`.

This library has been designed with the [GraphQL Cursor Connections Specification](https://relay.dev/graphql/connections.htm) in mind, but can be used for any cursor pagination (including REST).

## Install

[`npm i @ephys/sequelize-cursor-pagination`](https://www.npmjs.com/package/@ephys/sequelize-cursor-pagination)

TypeScript typings are built-in.

## Usage

`SequelizePage` is the main class of this library. It takes a set of options and returns
an object with methods to retrieve the paginated results and pagination metadata.

Here is a basic example that retrieves the first 10 results:

```typescript
import { SequelizePage } from '@ephys/sequelize-cursor-pagination';

const page = new SequelizePage({
  model: UserModel,
  // you can also use 'last'
  first: 10,

  // The sort order is mandatory and should include a unique index
  // If no unique index is included, the primary key will be added to the sort order by default.
  // The unique index is necessary to break ties and ensure a deterministic sort order,
  // which is required for any pagination to work correctly.
  order: [
    ['firstName', 'ASC'],
    ['lastName', 'ASC'],
  ],
});

// returns the first 10 users, sorted by firstName ASC, then lastName ASC
await page.getNodes();

// returns whether there are more users after the current page
await page.hasNextPage();

// returns whether there are users before the current page
await page.hasPreviousPage();

// returns the total number of users in the database
await page.getTotalCount();
```

## Pagination types

This library supports both cursor pagination (using `after`/`before`) and offset pagination (using `offset`), which can be optionally combined.

|                               | Cursor pagination                                                                          | Offset pagination                                                                     |
| ----------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| **Stable under mutations**    | ✅ Inserts/deletes between pages don't cause repeated or skipped items when changing pages | ❌ A row inserted or deleted before the current position shifts every subsequent page |
| **Arbitrary page jumps**      | ❌ Must walk page-by-page from a known cursor                                              | ✅ Can jump directly to any page                                                      |
| **Large dataset performance** | ✅ Efficient (if properly indexed) — filters by index using `WHERE`                        | ❌ Degrades with large offsets — the database must scan and discard skipped rows      |

As always, it depends on your use case and data:

- Cursor pagination is a good default for most production use cases, especially with frequently-changing data, large tables, infinite scrolling, or when you want to avoid exposing page numbers.
- Offset pagination is good when you need random page access and the dataset is small or stable.

## Pagination direction

This library does not expose a `limit` option. Instead, you specify the pagination direction and page size using the `first` and `last` options.

- `first` returns the first N elements in the list after applying filters (where, cursor, offset). It is a direct equivalent to using `limit`.
- `last` returns the last N elements in the list after applying filters (where, cursor, offset).

## Cursor

In cursor pagination (using `after`/`before`), you don't use page numbers or offsets.
Instead, you pass a stateless cursor that represents the position in the list where the page should start.

This library expects the cursor to be an object that contain the fields used to sort the results (accessible via the `cursorKeys` property).
This is the list of fields specified in the `order` option, plus a unique field (either a unique index or the primary key) to ensure a deterministic sort order.
If no unique index is included in the `order` option, the primary key will be added to the sort order by default.

In the following example, the sort order uses `firstName` and the table has `id` as the sole primary key.
Therefore, the cursor will be an object with the shape `{ firstName: string, id: number }`.

### Building the cursor

Use the `cursorKeys` field of the page to know exactly which fields are required in the cursor:

```typescript
const page = new SequelizePage({
  model: UserModel,
  first: 10,
  order: [['firstName', 'ASC']],
});

console.log(page.cursorKeys); // ["firstName", "id"] (note: include a unique column to avoid exposing the primary key if you don't want to expose it)
```

It is up to you to build & serialize the cursor in a way that makes sense for your application.
We recommend using opaque cursors. The following example shows how to serialize/deserializeCursor the cursor as a base64-encoded JSON string,
but you can use any serialization method you want:

```ts
function serializeCursor(node: object, cursorKeys: readonly string[]): string {
  const cursorObj = {};
  for (const key of cursorKeys) {
    cursorObj[key] = node[key];
  }

  return Buffer.from(JSON.stringify(cursorObj)).toString('base64');
}

function deserializeCursor(cursor: string): object {
  return JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8'));
}
```

### Fetching the next page

To fetch the next page, pass a cursor object to the `after` option.

```typescript
const page = new SequelizePage({
  model: UserModel,
  first: 10,
  // "SequelizePage" expects an object, but you can serialize it as a string for your API layer if you prefer.
  after: {
    id: 6,
    firstName: 'Bernard',
  },
  order: [['firstName', 'ASC']],
});
```

### Fetching the previous page

To fetch the previous page, pass a cursor object to the `before` option and use `last` instead of `first`.

The query will first limit the results to the items before the cursor, then return the last N items from that filtered set.

```typescript
const page = new SequelizePage({
  model: UserModel,
  last: 10,
  before: {
    id: 6,
    firstName: 'Bernard',
  },
  order: [['firstName', 'ASC']],
});
```

### Offset

The `offset` option works exactly like the standard Sequelize `offset` option: it skips a number of items from the results after applying the filters.

```typescript
// Skip the first 5 results, then return the next 10
const page = new SequelizePage({
  model: UserModel,
  first: 10,
  offset: 5,
  order: [['firstName', 'ASC']],
});
```

It can also be used with `last` to skip items from the end of the list:

```typescript
// Skip the last 5 results, then return the previous 10
const page = new SequelizePage({
  model: UserModel,
  last: 10,
  offset: 5,
  order: [['firstName', 'ASC']],
});
```

It can also be combined with forward cursor pagination to skip items after the cursor:

```typescript
// Skip the first 5 results after the cursor, then return the next 10
const page = new SequelizePage({
  model: UserModel,
  first: 10,
  after: { id: 6, firstName: 'Bernard' },
  offset: 5,
  order: [['firstName', 'ASC']],
});
```

And with backward cursor pagination to skip items before the cursor:

```typescript
// Skip the last 5 results before the cursor, then return the previous 10
const page = new SequelizePage({
  model: UserModel,
  last: 10,
  before: { id: 6, firstName: 'Bernard' },
  offset: 5,
  order: [['firstName', 'ASC']],
});
```

## hasNextPage and hasPreviousPage

The `hasNextPage()` and `hasPreviousPage()` methods return a boolean indicating whether there are more items after or before the current page, respectively.

```typescript
const page = new SequelizePage({
  model: UserModel,
  first: 10,
  after: { id: 6, firstName: 'Bernard', lastName: '' },
  where: { isActive: true },
  order: [['firstName', 'ASC']],
});

console.log(await page.hasNextPage()); // whether there are more active users after the current page
console.log(await page.hasPreviousPage()); // whether there are active users before the current page
```

They are async, but are designed to be efficient and will not run additional queries if the information is already available.

## Total Count

The `getTotalCount()` method returns the total number of records that match the base `where` filter,
**ignoring** any cursor (`after`/`before`) and pagination (`first`/`last`/`offset`).
This is useful for building "Page 1 of N" style UIs.

```typescript
const page = new SequelizePage({
  model: UserModel,
  first: 10,
  after: { id: 6, firstName: 'Bernard', lastName: '' },
  where: { isActive: true },
  order: [['firstName', 'ASC']],
});

console.log((await page.getNodes()).length); // up to 10 (cursor-filtered page)
console.log(await page.getTotalCount()); // total active users, regardless of cursor
```

## Options

`SequelizePage` supports a series of standard sequelize options such as:

- `transaction`
- `logging`
- `where`
- `attributes`
- `offset` — skip N items from the start (with `first`) or the end (with `last`) of the cursor-filtered set

Check the TypeScript typings for more.

### Customizing the query

If the available options are not enough, you can use the escape hatch to build the query yourself.
It should be used as a last resort.

```typescript
const page = new SequelizePage({
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
