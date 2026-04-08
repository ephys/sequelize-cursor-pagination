import type { ModelStatic } from '@sequelize/core';
import { DataTypes, Op, Sequelize } from '@sequelize/core';
// eslint-disable-next-line no-restricted-imports
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { TEST_databaseCredentials } from './__test-utils__/sequelize.js';
import { sequelizeFindByCursor } from './index.js';

let sequelize: Sequelize;
let userModel: ModelStatic<any>;

before(async () => {
  sequelize = new Sequelize(TEST_databaseCredentials);

  userModel = sequelize.define('User', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    externalId: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false,
    },
    compositeUnique1: {
      type: DataTypes.STRING,
      unique: 'composite',
      allowNull: false,
    },
    compositeUnique2: {
      type: DataTypes.STRING,
      unique: 'composite',
      allowNull: false,
    },

    firstName: {
      field: 'first_name',
      type: DataTypes.TEXT,
      allowNull: false,
    },
    lastName: {
      field: 'last_name',
      type: DataTypes.TEXT,
      allowNull: false,
    },
    birthDate: {
      field: 'birth_date',
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
  });

  await sequelize.sync({
    force: true,
  });

  await userModel.bulkCreate([
    {
      id: 5,
      externalId: 'A',
      compositeUnique1: 'A',
      compositeUnique2: '1',
      firstName: 'Alan',
      lastName: 'LastName',
      birthDate: '2000-01-01',
    },
    {
      id: 4,
      externalId: 'B',
      compositeUnique1: 'A',
      compositeUnique2: '2',
      firstName: 'Bernard',
      lastName: 'LastName',
      birthDate: '1970-01-01',
    },
    {
      id: 3,
      externalId: 'C',
      compositeUnique1: 'A',
      compositeUnique2: '3',
      firstName: 'Cedric',
      lastName: 'Anderson',
      birthDate: '1980-01-01',
    },
    {
      id: 2,
      externalId: 'D',
      compositeUnique1: 'A',
      compositeUnique2: '4',
      firstName: 'Cedric',
      lastName: 'Brown',
      birthDate: '1960-01-01',
    },
    {
      id: 6,
      externalId: 'E',
      compositeUnique1: 'A',
      compositeUnique2: '5',
      firstName: 'Dimitri',
      lastName: 'LastName',
      birthDate: '1990-01-01',
    },
    {
      id: 1,
      externalId: 'F',
      compositeUnique1: 'A',
      compositeUnique2: '6',
      firstName: 'Dimitri',
      lastName: 'LastName',
      birthDate: '2010-01-01',
    },
  ]);
});

describe('sequelizeFindByCursor', () => {
  it('includes PK in ORDER BY to ensures constant order', async (t) => {
    const results = sequelizeFindByCursor({
      attributes: ['firstName', 'lastName', 'id'],
      model: userModel,
      first: 10,
      order: [
        ['firstName', 'ASC'],
        ['lastName', 'ASC'],
      ],
      logging: (query) => {
        t.assert.snapshot(query);
      },
    });

    // "Dimitri LastName" (1) should be before "Dimitri LastName" (6)

    t.assert.snapshot(await results.getNodes());
    assert.strictEqual(await results.hasNextPage(), false);
    assert.strictEqual(await results.hasPreviousPage(), false);
  });

  it("does not include extra PK in ORDER BY if it's already present", async (t) => {
    const results = sequelizeFindByCursor({
      attributes: ['firstName', 'lastName', 'id'],
      model: userModel,
      first: 10,
      order: [
        ['firstName', 'ASC'],
        ['lastName', 'ASC'],
        ['id', 'DESC'],
      ],
      logging: (query) => {
        t.assert.snapshot(query);
      },
    });

    // "Dimitri LastName" (6) should be before "Dimitri LastName" (1)

    t.assert.snapshot(await results.getNodes());
    assert.strictEqual(await results.hasNextPage(), false);
    assert.strictEqual(await results.hasPreviousPage(), false);
  });

  it('supports returning the first x elements of the set', async (t) => {
    const results = sequelizeFindByCursor({
      attributes: ['firstName', 'lastName', 'id'],
      model: userModel,
      first: 2,
      order: [
        ['firstName', 'ASC'],
        ['lastName', 'ASC'],
      ],
    });

    t.assert.snapshot(await results.getNodes());
    assert.strictEqual(await results.hasNextPage(), true);
    assert.strictEqual(await results.hasPreviousPage(), false);
  });

  it('supports returning the last x elements of the set', async (t) => {
    const results = sequelizeFindByCursor({
      attributes: ['firstName', 'lastName', 'id'],
      model: userModel,
      last: 2,
      order: [
        ['firstName', 'ASC'],
        ['lastName', 'ASC'],
      ],
    });

    t.assert.snapshot(await results.getNodes());
    assert.strictEqual(await results.hasNextPage(), false);
    assert.strictEqual(await results.hasPreviousPage(), true);
  });

  it('supports returning the first x elements after another cursor', async (t) => {
    const results = sequelizeFindByCursor({
      attributes: ['firstName', 'lastName', 'id'],
      model: userModel,
      first: 2,
      after: {
        id: 3,
        firstName: 'Cedric',
        lastName: 'Anderson',
      },
      order: [
        ['firstName', 'ASC'],
        ['lastName', 'ASC'],
      ],
    });

    t.assert.snapshot(await results.getNodes());
    assert.strictEqual(await results.hasNextPage(), true);
    assert.strictEqual(await results.hasPreviousPage(), true);
  });

  it('supports returning the last x elements after another cursor', async (t) => {
    const results = sequelizeFindByCursor({
      attributes: ['firstName', 'lastName', 'id'],
      model: userModel,
      last: 2,
      after: {
        id: 3,
        firstName: 'Cedric',
        lastName: 'Anderson',
      },
      order: [
        ['firstName', 'ASC'],
        ['lastName', 'ASC'],
      ],
    });

    t.assert.snapshot(await results.getNodes());
    assert.strictEqual(await results.hasNextPage(), false);
    assert.strictEqual(await results.hasPreviousPage(), true);
  });

  it('supports returning the first x elements before another cursor', async (t) => {
    const results = sequelizeFindByCursor({
      attributes: ['firstName', 'lastName', 'id'],
      model: userModel,
      first: 2,
      before: {
        id: 3,
        firstName: 'Cedric',
        lastName: 'Anderson',
      },
      order: [
        ['firstName', 'ASC'],
        ['lastName', 'ASC'],
      ],
    });

    t.assert.snapshot(await results.getNodes());
    assert.strictEqual(await results.hasNextPage(), false);
    assert.strictEqual(await results.hasPreviousPage(), false);
  });

  it('supports returning the last x elements before another cursor', async (t) => {
    const results = sequelizeFindByCursor({
      attributes: ['firstName', 'lastName', 'id'],
      model: userModel,
      last: 2,
      before: {
        id: 1,
        firstName: 'Dimitri',
        lastName: 'LastName',
      },
      order: [
        ['firstName', 'ASC'],
        ['lastName', 'ASC'],
      ],
    });

    t.assert.snapshot(await results.getNodes());
    assert.strictEqual(await results.hasNextPage(), true);
    assert.strictEqual(await results.hasPreviousPage(), true);
  });

  it('supports filtering', async (t) => {
    const results = sequelizeFindByCursor({
      attributes: ['firstName', 'lastName', 'id'],
      model: userModel,
      first: 10,
      after: {
        id: 4,
        firstName: 'Bernard',
        lastName: 'LastName',
      },
      // this WHERE will be joined to the cursor filter using AND
      where: {
        birthDate: { [Op.gte]: '1990-01-01' },
      },
      order: [
        ['firstName', 'ASC'],
        ['lastName', 'ASC'],
      ],
      logging: (sql) => {
        t.assert.snapshot(sql);
      },
    });

    t.assert.snapshot(await results.getNodes());
    assert.strictEqual(await results.hasNextPage(), false);
    assert.strictEqual(await results.hasPreviousPage(), true);
  });

  it('returns the keys used for the cursor (no unique specified: adds PK)', async () => {
    const results = sequelizeFindByCursor({
      attributes: ['firstName', 'id'],
      model: userModel,
      first: 10,
      order: [['firstName', 'ASC']],
    });

    assert.deepStrictEqual(results.cursorKeys, ['firstName', 'id']);
  });

  it('returns the keys used for the cursor (Unique specified)', async () => {
    const results = sequelizeFindByCursor({
      attributes: ['firstName', 'externalId'],
      model: userModel,
      first: 10,
      order: [
        ['firstName', 'ASC'],
        ['externalId', 'ASC'],
      ],
    });

    assert.deepStrictEqual(results.cursorKeys, ['firstName', 'externalId']);
  });

  it('returns the keys used for the cursor (Composite unique partly specified: adds PK)', async () => {
    const results = sequelizeFindByCursor({
      attributes: ['firstName', 'compositeUnique1'],
      model: userModel,
      first: 10,
      order: [
        ['firstName', 'ASC'],
        ['compositeUnique1', 'ASC'],
      ],
    });

    assert.deepStrictEqual(results.cursorKeys, [
      'firstName',
      'compositeUnique1',
      'id',
    ]);
  });

  it('returns the keys used for the cursor (Composite unique fully specified)', async () => {
    const results = sequelizeFindByCursor({
      attributes: ['firstName', 'compositeUnique1', 'compositeUnique2'],
      model: userModel,
      first: 10,
      order: [
        ['firstName', 'ASC'],
        ['compositeUnique1', 'ASC'],
        ['compositeUnique2', 'ASC'],
      ],
    });

    assert.deepStrictEqual(results.cursorKeys, [
      'firstName',
      'compositeUnique1',
      'compositeUnique2',
    ]);
  });

  // Offset pagination tests
  // Ordered set: Alan(5), Bernard(4), Cedric Anderson(3), Cedric Brown(2), Dimitri(1), Dimitri(6)

  it('offset: skips the first N items when using first', async (t) => {
    // first:2 offset:2 → skip Alan, Bernard → Cedric Anderson(3), Cedric Brown(2)
    const results = sequelizeFindByCursor({
      attributes: ['firstName', 'lastName', 'id'],
      model: userModel,
      first: 2,
      offset: 2,
      order: [
        ['firstName', 'ASC'],
        ['lastName', 'ASC'],
      ],
    });

    t.assert.snapshot(await results.getNodes());
    assert.strictEqual(await results.hasPreviousPage(), true);
    assert.strictEqual(await results.hasNextPage(), true);
  });

  it('offset: skips the last N items when using last', async (t) => {
    // last:2 offset:2 → skip Dimitri(1), Dimitri(6) from end → Cedric Anderson(3), Cedric Brown(2)
    const results = sequelizeFindByCursor({
      attributes: ['firstName', 'lastName', 'id'],
      model: userModel,
      last: 2,
      offset: 2,
      order: [
        ['firstName', 'ASC'],
        ['lastName', 'ASC'],
      ],
    });

    t.assert.snapshot(await results.getNodes());
    assert.strictEqual(await results.hasPreviousPage(), true);
    assert.strictEqual(await results.hasNextPage(), true);
  });

  it('offset: can be combined with after cursor (first)', async (t) => {
    // after: Cedric Anderson(3) → set is [Cedric Brown(2), Dimitri(1), Dimitri(6)]
    // offset:1, first:2 → skip Cedric Brown(2) → Dimitri(1), Dimitri(6)
    const results = sequelizeFindByCursor({
      attributes: ['firstName', 'lastName', 'id'],
      model: userModel,
      first: 2,
      offset: 1,
      after: {
        id: 3,
        firstName: 'Cedric',
        lastName: 'Anderson',
      },
      order: [
        ['firstName', 'ASC'],
        ['lastName', 'ASC'],
      ],
    });

    t.assert.snapshot(await results.getNodes());
    assert.strictEqual(await results.hasPreviousPage(), true);
    assert.strictEqual(await results.hasNextPage(), false);
  });

  it('offset: can be combined with after cursor (last)', async (t) => {
    // after: Cedric Anderson(3) → set is [Cedric Brown(2), Dimitri(1), Dimitri(6)]
    // offset:1, last:2 → skip Dimitri(6) from end → Cedric Brown(2), Dimitri(1)
    const results = sequelizeFindByCursor({
      attributes: ['firstName', 'lastName', 'id'],
      model: userModel,
      last: 2,
      offset: 1,
      after: {
        id: 3,
        firstName: 'Cedric',
        lastName: 'Anderson',
      },
      order: [
        ['firstName', 'ASC'],
        ['lastName', 'ASC'],
      ],
    });

    t.assert.snapshot(await results.getNodes());
    assert.strictEqual(await results.hasPreviousPage(), false);
    assert.strictEqual(await results.hasNextPage(), true);
  });

  it('offset: can be combined with before cursor (last)', async (t) => {
    // before: Dimitri(6) → set is [Alan(5), Bernard(4), Cedric Anderson(3), Cedric Brown(2), Dimitri(1)]
    // offset:1, last:2 → skip Dimitri(1) from end → Cedric Anderson(3), Cedric Brown(2)
    const results = sequelizeFindByCursor({
      attributes: ['firstName', 'lastName', 'id'],
      model: userModel,
      last: 2,
      offset: 1,
      before: {
        id: 6,
        firstName: 'Dimitri',
        lastName: 'LastName',
      },
      order: [
        ['firstName', 'ASC'],
        ['lastName', 'ASC'],
      ],
    });

    t.assert.snapshot(await results.getNodes());
    assert.strictEqual(await results.hasPreviousPage(), true);
    assert.strictEqual(await results.hasNextPage(), true);
  });

  it('offset: can be combined with before cursor (first)', async (t) => {
    // before: Dimitri(6) → set is [Alan(5), Bernard(4), Cedric Anderson(3), Cedric Brown(2), Dimitri(1)]
    // offset:1, first:2 → skip Alan(5) → Bernard(4), Cedric Anderson(3)
    const results = sequelizeFindByCursor({
      attributes: ['firstName', 'lastName', 'id'],
      model: userModel,
      first: 2,
      offset: 1,
      before: {
        id: 6,
        firstName: 'Dimitri',
        lastName: 'LastName',
      },
      order: [
        ['firstName', 'ASC'],
        ['lastName', 'ASC'],
      ],
    });

    t.assert.snapshot(await results.getNodes());
    assert.strictEqual(await results.hasPreviousPage(), true);
    assert.strictEqual(await results.hasNextPage(), true);
  });

  it('offset: offset beyond available items returns empty result', async () => {
    // 6 total items, offset:10, first:2 → nothing to return
    const results = sequelizeFindByCursor({
      attributes: ['firstName', 'lastName', 'id'],
      model: userModel,
      first: 2,
      offset: 10,
      order: [
        ['firstName', 'ASC'],
        ['lastName', 'ASC'],
      ],
    });

    assert.strictEqual((await results.getNodes()).length, 0);
    assert.strictEqual(await results.hasPreviousPage(), true);
    assert.strictEqual(await results.hasNextPage(), false);
  });

  it('offset: offset=0 is equivalent to no offset (first)', async () => {
    const withOffset = sequelizeFindByCursor({
      attributes: ['firstName', 'lastName', 'id'],
      model: userModel,
      first: 3,
      offset: 0,
      order: [
        ['firstName', 'ASC'],
        ['lastName', 'ASC'],
      ],
    });

    const withoutOffset = sequelizeFindByCursor({
      attributes: ['firstName', 'lastName', 'id'],
      model: userModel,
      first: 3,
      order: [
        ['firstName', 'ASC'],
        ['lastName', 'ASC'],
      ],
    });

    assert.deepStrictEqual(
      (await withOffset.getNodes()).map((n: any) => n.id),
      (await withoutOffset.getNodes()).map((n: any) => n.id),
    );
    assert.strictEqual(
      await withOffset.hasPreviousPage(),
      await withoutOffset.hasPreviousPage(),
    );
    assert.strictEqual(
      await withOffset.hasNextPage(),
      await withoutOffset.hasNextPage(),
    );
  });

  it('offset: throws when offset is negative', () => {
    assert.throws(
      () =>
        sequelizeFindByCursor({
          attributes: ['firstName', 'lastName', 'id'],
          model: userModel,
          first: 2,
          offset: -1,
          order: [['firstName', 'ASC']],
        }),
      { message: `'offset' must be a non-negative safe integer` },
    );
  });

  it('nodes/hasNextPage/hasPreviousPage: are lazily evaluated — do not query the DB until called', async () => {
    let findAllCallCount = 0;
    const results = sequelizeFindByCursor({
      model: userModel,
      first: 2,
      order: [['firstName', 'ASC']],
      findAll: async (query) => {
        findAllCallCount++;

        return userModel.findAll(query);
      },
    });

    assert.strictEqual(findAllCallCount, 0);

    await results.getNodes();
    assert.strictEqual(findAllCallCount, 1);
  });

  it('nodes/hasNextPage/hasPreviousPage: share a single DB query when called in parallel', async () => {
    let findAllCallCount = 0;
    const results = sequelizeFindByCursor({
      model: userModel,
      first: 2,
      order: [['firstName', 'ASC']],
      findAll: async (query) => {
        findAllCallCount++;

        return userModel.findAll(query);
      },
    });

    await Promise.all([
      results.getNodes(),
      results.hasNextPage(),
      results.hasPreviousPage(),
    ]);
    assert.strictEqual(findAllCallCount, 1);
  });

  it('nodes/hasNextPage/hasPreviousPage: using last — getNodes and hasPreviousPage share one query; hasNextPage resolves without a query', async () => {
    // With `last`, isLast=true:
    //   getNodes()        → #getPageDeduped (shared)
    //   hasPreviousPage() → #getPageDeduped (shared)
    //   hasNextPage()     → isLast=true, offset=0, no `before` cursor → returns false immediately
    let findAllCallCount = 0;
    const results = sequelizeFindByCursor({
      model: userModel,
      last: 2,
      order: [['firstName', 'ASC']],
      findAll: async (query) => {
        findAllCallCount++;

        return userModel.findAll(query);
      },
    });

    await Promise.all([
      results.getNodes(),
      results.hasNextPage(),
      results.hasPreviousPage(),
    ]);
    assert.strictEqual(findAllCallCount, 1);
  });

  it('nodes/hasNextPage/hasPreviousPage: using first+after — getNodes and hasNextPage share one query; hasPreviousPage makes a separate backwards query', async () => {
    // With `first` + `after`, isLast=false:
    //   getNodes()        → #getPageDeduped (shared)
    //   hasNextPage()     → #getPageDeduped (shared)
    //   hasPreviousPage() → after is set → separate getPage call with reversed cursor
    let findAllCallCount = 0;
    const results = sequelizeFindByCursor({
      model: userModel,
      first: 2,
      after: { id: 3, firstName: 'Cedric', lastName: 'Anderson' },
      order: [
        ['firstName', 'ASC'],
        ['lastName', 'ASC'],
      ],
      findAll: async (query) => {
        findAllCallCount++;

        return userModel.findAll(query);
      },
    });

    await Promise.all([
      results.getNodes(),
      results.hasNextPage(),
      results.hasPreviousPage(),
    ]);
    assert.strictEqual(findAllCallCount, 2);
  });

  it('nodes/hasNextPage/hasPreviousPage: using last+before — getNodes and hasPreviousPage share one query; hasNextPage makes a separate forwards query', async () => {
    // With `last` + `before`, isLast=true:
    //   getNodes()        → #getPageDeduped (shared)
    //   hasPreviousPage() → #getPageDeduped (shared)
    //   hasNextPage()     → before is set → separate getPage call with reversed cursor
    let findAllCallCount = 0;
    const results = sequelizeFindByCursor({
      model: userModel,
      last: 2,
      before: { id: 1, firstName: 'Dimitri', lastName: 'LastName' },
      order: [
        ['firstName', 'ASC'],
        ['lastName', 'ASC'],
      ],
      findAll: async (query) => {
        findAllCallCount++;

        return userModel.findAll(query);
      },
    });

    await Promise.all([
      results.getNodes(),
      results.hasNextPage(),
      results.hasPreviousPage(),
    ]);
    assert.strictEqual(findAllCallCount, 2);
  });

  it('nodes/hasNextPage/hasPreviousPage: sequential calls each trigger their own query (deduplication does not persist across calls)', async () => {
    // Deduplication only coalesces calls made before the first query settles.
    // Once the promise resolves, subsequent calls start a fresh query.
    let findAllCallCount = 0;
    const results = sequelizeFindByCursor({
      model: userModel,
      first: 2,
      order: [['firstName', 'ASC']],
      findAll: async (query) => {
        findAllCallCount++;

        return userModel.findAll(query);
      },
    });

    await results.getNodes(); // query 1
    await results.hasNextPage(); // query 2 (dedup promise already settled and cleared)
    assert.strictEqual(findAllCallCount, 2);
  });

  describe('getTotalCount', () => {
    // Ordered set (by firstName ASC, lastName ASC, id ASC):
    // Alan(5), Bernard(4), Cedric Anderson(3), Cedric Brown(2), Dimitri LastName(1), Dimitri LastName(6)
    // Total = 6

    it('returns the total count of all records when no filter is applied', async () => {
      const results = sequelizeFindByCursor({
        model: userModel,
        first: 2, // only fetches 2 nodes, but total should still be 6
        order: [['firstName', 'ASC']],
      });

      assert.strictEqual(await results.getTotalCount(), 6);
    });

    it('respects the where filter but ignores cursor constraints', async () => {
      // birthDate >= 1990-01-01 matches: Alan(2000), Dimitri(1990), Dimitri(2010) → 3 records
      const results = sequelizeFindByCursor({
        model: userModel,
        first: 1, // only fetches 1 node
        where: { birthDate: { [Op.gte]: '1990-01-01' } },
        order: [['firstName', 'ASC']],
      });

      assert.strictEqual(await results.getTotalCount(), 3);
    });

    it('ignores after cursor (counts entire matching set, not the cursor-filtered subset)', async () => {
      // after: Cedric Anderson(3) normally filters to 3 records, but totalCount should still be 6
      const results = sequelizeFindByCursor({
        model: userModel,
        first: 10,
        after: { id: 3, firstName: 'Cedric', lastName: 'Anderson' },
        order: [
          ['firstName', 'ASC'],
          ['lastName', 'ASC'],
        ],
      });

      assert.strictEqual((await results.getNodes()).length, 3); // only 3 after the cursor
      assert.strictEqual(await results.getTotalCount(), 6); // but total is still 6
    });

    it('ignores before cursor (counts entire matching set, not the cursor-filtered subset)', async () => {
      // before: Cedric Anderson(3) normally filters to 2 records, but totalCount should still be 6
      const results = sequelizeFindByCursor({
        model: userModel,
        first: 10,
        before: { id: 3, firstName: 'Cedric', lastName: 'Anderson' },
        order: [
          ['firstName', 'ASC'],
          ['lastName', 'ASC'],
        ],
      });

      assert.strictEqual((await results.getNodes()).length, 2); // only 2 before the cursor
      assert.strictEqual(await results.getTotalCount(), 6); // but total is still 6
    });

    it('is lazily evaluated — does not query the DB until called', async (t) => {
      const countSpy = t.mock.method(userModel, 'count');

      sequelizeFindByCursor({
        model: userModel,
        first: 2,
        order: [['firstName', 'ASC']],
      });

      assert.strictEqual(countSpy.mock.calls.length, 0);
    });
  });
});

after(async () => {
  await sequelize.close();
});
