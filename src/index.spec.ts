import type { ModelStatic } from "@sequelize/core";
import { DataTypes, Op, Sequelize } from "@sequelize/core";
import { TEST_databaseCredentials } from "./__test-utils__/sequelize";
import { sequelizeFindByCursor } from ".";

let sequelize: Sequelize;
let userModel: ModelStatic<any>;

// TODO: ensure hasPreviousPage, hasNextPage is returning the correct value.

beforeAll(async () => {
  sequelize = new Sequelize(TEST_databaseCredentials);

  userModel = sequelize.define("User", {
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
      unique: "composite",
      allowNull: false,
    },
    compositeUnique2: {
      type: DataTypes.STRING,
      unique: "composite",
      allowNull: false,
    },

    firstName: {
      field: "first_name",
      type: DataTypes.TEXT,
      allowNull: false,
    },
    lastName: {
      field: "last_name",
      type: DataTypes.TEXT,
      allowNull: false,
    },
    birthDate: {
      field: "birth_date",
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
      externalId: "A",
      compositeUnique1: "A",
      compositeUnique2: "1",
      firstName: "Alan",
      lastName: "LastName",
      birthDate: "2000-01-01",
    },
    {
      id: 4,
      externalId: "B",
      compositeUnique1: "A",
      compositeUnique2: "2",
      firstName: "Bernard",
      lastName: "LastName",
      birthDate: "1970-01-01",
    },
    {
      id: 3,
      externalId: "C",
      compositeUnique1: "A",
      compositeUnique2: "3",
      firstName: "Cedric",
      lastName: "Anderson",
      birthDate: "1980-01-01",
    },
    {
      id: 2,
      externalId: "D",
      compositeUnique1: "A",
      compositeUnique2: "4",
      firstName: "Cedric",
      lastName: "Brown",
      birthDate: "1960-01-01",
    },
    {
      id: 6,
      externalId: "E",
      compositeUnique1: "A",
      compositeUnique2: "5",
      firstName: "Dimitri",
      lastName: "LastName",
      birthDate: "1990-01-01",
    },
    {
      id: 1,
      externalId: "F",
      compositeUnique1: "A",
      compositeUnique2: "6",
      firstName: "Dimitri",
      lastName: "LastName",
      birthDate: "2010-01-01",
    },
  ]);
});

describe("sequelizeFindByCursor", () => {
  it("includes PK in ORDER BY to ensures constant order", async () => {
    const results = await sequelizeFindByCursor({
      attributes: ["firstName", "lastName", "id"],
      model: userModel,
      first: 10,
      order: [
        ["firstName", "ASC"],
        ["lastName", "ASC"],
      ],
      logging: (query) => {
        expect(query).toMatchSnapshot("query");
      },
    });

    // "Dimitri LastName" (1) should be before "Dimitri LastName" (6)

    expect(results.nodes).toMatchSnapshot("nodes");
    expect(await results.hasNextPage()).toBe(false);
    expect(await results.hasPreviousPage()).toBe(false);
  });

  it("does not include extra PK in ORDER BY if it’s already present", async () => {
    const results = await sequelizeFindByCursor({
      attributes: ["firstName", "lastName", "id"],
      model: userModel,
      first: 10,
      order: [
        ["firstName", "ASC"],
        ["lastName", "ASC"],
        ["id", "DESC"],
      ],
      logging: (query) => {
        expect(query).toMatchSnapshot("query");
      },
    });

    // "Dimitri LastName" (6) should be before "Dimitri LastName" (1)

    expect(results.nodes).toMatchSnapshot("nodes");
    expect(await results.hasNextPage()).toBe(false);
    expect(await results.hasPreviousPage()).toBe(false);
  });

  it("supports returning the first x elements of the set", async () => {
    const results = await sequelizeFindByCursor({
      attributes: ["firstName", "lastName", "id"],
      model: userModel,
      first: 2,
      order: [
        ["firstName", "ASC"],
        ["lastName", "ASC"],
      ],
    });

    expect(results.nodes).toMatchSnapshot("nodes");
    expect(await results.hasNextPage()).toBe(true);
    expect(await results.hasPreviousPage()).toBe(false);
  });

  it("supports returning the last x elements of the set", async () => {
    const results = await sequelizeFindByCursor({
      attributes: ["firstName", "lastName", "id"],
      model: userModel,
      last: 2,
      order: [
        ["firstName", "ASC"],
        ["lastName", "ASC"],
      ],
    });

    expect(results.nodes).toMatchSnapshot("nodes");
    expect(await results.hasNextPage()).toBe(false);
    expect(await results.hasPreviousPage()).toBe(true);
  });

  it("supports returning the first x elements after another cursor", async () => {
    const results = await sequelizeFindByCursor({
      attributes: ["firstName", "lastName", "id"],
      model: userModel,
      first: 2,
      after: {
        id: 3,
        firstName: "Cedric",
        lastName: "Anderson",
      },
      order: [
        ["firstName", "ASC"],
        ["lastName", "ASC"],
      ],
    });

    expect(results.nodes).toMatchSnapshot("nodes");
    expect(await results.hasNextPage()).toBe(true);
    expect(await results.hasPreviousPage()).toBe(true);
  });

  it("supports returning the last x elements after another cursor", async () => {
    const results = await sequelizeFindByCursor({
      attributes: ["firstName", "lastName", "id"],
      model: userModel,
      last: 2,
      after: {
        id: 3,
        firstName: "Cedric",
        lastName: "Anderson",
      },
      order: [
        ["firstName", "ASC"],
        ["lastName", "ASC"],
      ],
    });

    expect(results.nodes).toMatchSnapshot("nodes");
    expect(await results.hasNextPage()).toBe(false);
    expect(await results.hasPreviousPage()).toBe(true);
  });

  it("supports returning the first x elements before another cursor", async () => {
    const results = await sequelizeFindByCursor({
      attributes: ["firstName", "lastName", "id"],
      model: userModel,
      first: 2,
      before: {
        id: 3,
        firstName: "Cedric",
        lastName: "Anderson",
      },
      order: [
        ["firstName", "ASC"],
        ["lastName", "ASC"],
      ],
    });

    expect(results.nodes).toMatchSnapshot("nodes");
    expect(await results.hasNextPage()).toBe(false);
    expect(await results.hasPreviousPage()).toBe(false);
  });

  it("supports returning the last x elements before another cursor", async () => {
    const results = await sequelizeFindByCursor({
      attributes: ["firstName", "lastName", "id"],
      model: userModel,
      last: 2,
      before: {
        id: 1,
        firstName: "Dimitri",
        lastName: "LastName",
      },
      order: [
        ["firstName", "ASC"],
        ["lastName", "ASC"],
      ],
    });

    expect(results.nodes).toMatchSnapshot("nodes");
    expect(await results.hasNextPage()).toBe(true);
    expect(await results.hasPreviousPage()).toBe(true);
  });

  it("supports filtering", async () => {
    const results = await sequelizeFindByCursor({
      attributes: ["firstName", "lastName", "id"],
      model: userModel,
      first: 10,
      after: {
        id: 4,
        firstName: "Bernard",
        lastName: "LastName",
      },
      // this WHERE will be joined to the cursor filter using AND
      where: {
        birthDate: { [Op.gte]: "1990-01-01" },
      },
      order: [
        ["firstName", "ASC"],
        ["lastName", "ASC"],
      ],
      logging: (sql) => {
        expect(sql).toMatchSnapshot("query");
      },
    });

    expect(results.nodes).toMatchSnapshot("nodes");
    expect(await results.hasNextPage()).toBe(false);
    expect(await results.hasPreviousPage()).toBe(true);
  });

  it("returns the keys used for the cursor (no unique specified: adds PK)", async () => {
    const results = await sequelizeFindByCursor({
      attributes: ["firstName", "id"],
      model: userModel,
      first: 10,
      order: [["firstName", "ASC"]],
    });

    expect(results.cursorKeys).toEqual(["firstName", "id"]);
  });

  it("returns the keys used for the cursor (Unique specified)", async () => {
    const results = await sequelizeFindByCursor({
      attributes: ["firstName", "externalId"],
      model: userModel,
      first: 10,
      order: [
        ["firstName", "ASC"],
        ["externalId", "ASC"],
      ],
    });

    expect(results.cursorKeys).toEqual(["firstName", "externalId"]);
  });

  it("returns the keys used for the cursor (Composite unique partly specified: adds PK)", async () => {
    const results = await sequelizeFindByCursor({
      attributes: ["firstName", "compositeUnique1"],
      model: userModel,
      first: 10,
      order: [
        ["firstName", "ASC"],
        ["compositeUnique1", "ASC"],
      ],
    });

    expect(results.cursorKeys).toEqual(["firstName", "compositeUnique1", "id"]);
  });

  it("returns the keys used for the cursor (Composite unique fully specified)", async () => {
    const results = await sequelizeFindByCursor({
      attributes: ["firstName", "compositeUnique1", "compositeUnique2"],
      model: userModel,
      first: 10,
      order: [
        ["firstName", "ASC"],
        ["compositeUnique1", "ASC"],
        ["compositeUnique2", "ASC"],
      ],
    });

    expect(results.cursorKeys).toEqual([
      "firstName",
      "compositeUnique1",
      "compositeUnique2",
    ]);
  });

  // Offset pagination tests
  // Ordered set: Alan(5), Bernard(4), Cedric Anderson(3), Cedric Brown(2), Dimitri(1), Dimitri(6)

  it("offset: skips the first N items when using first", async () => {
    // first:2 offset:2 → skip Alan, Bernard → Cedric Anderson(3), Cedric Brown(2)
    const results = await sequelizeFindByCursor({
      attributes: ["firstName", "lastName", "id"],
      model: userModel,
      first: 2,
      offset: 2,
      order: [
        ["firstName", "ASC"],
        ["lastName", "ASC"],
      ],
    });

    expect(results.nodes).toMatchSnapshot("nodes");
    expect(await results.hasPreviousPage()).toBe(true);
    expect(await results.hasNextPage()).toBe(true);
  });

  it("offset: skips the last N items when using last", async () => {
    // last:2 offset:2 → skip Dimitri(1), Dimitri(6) from end → Cedric Anderson(3), Cedric Brown(2)
    const results = await sequelizeFindByCursor({
      attributes: ["firstName", "lastName", "id"],
      model: userModel,
      last: 2,
      offset: 2,
      order: [
        ["firstName", "ASC"],
        ["lastName", "ASC"],
      ],
    });

    expect(results.nodes).toMatchSnapshot("nodes");
    expect(await results.hasPreviousPage()).toBe(true);
    expect(await results.hasNextPage()).toBe(true);
  });

  it("offset: can be combined with after cursor (first)", async () => {
    // after: Cedric Anderson(3) → set is [Cedric Brown(2), Dimitri(1), Dimitri(6)]
    // offset:1, first:2 → skip Cedric Brown(2) → Dimitri(1), Dimitri(6)
    const results = await sequelizeFindByCursor({
      attributes: ["firstName", "lastName", "id"],
      model: userModel,
      first: 2,
      offset: 1,
      after: {
        id: 3,
        firstName: "Cedric",
        lastName: "Anderson",
      },
      order: [
        ["firstName", "ASC"],
        ["lastName", "ASC"],
      ],
    });

    expect(results.nodes).toMatchSnapshot("nodes");
    expect(await results.hasPreviousPage()).toBe(true);
    expect(await results.hasNextPage()).toBe(false);
  });

  it("offset: can be combined with after cursor (last)", async () => {
    // after: Cedric Anderson(3) → set is [Cedric Brown(2), Dimitri(1), Dimitri(6)]
    // offset:1, last:2 → skip Dimitri(6) from end → Cedric Brown(2), Dimitri(1)
    const results = await sequelizeFindByCursor({
      attributes: ["firstName", "lastName", "id"],
      model: userModel,
      last: 2,
      offset: 1,
      after: {
        id: 3,
        firstName: "Cedric",
        lastName: "Anderson",
      },
      order: [
        ["firstName", "ASC"],
        ["lastName", "ASC"],
      ],
    });

    expect(results.nodes).toMatchSnapshot("nodes");
    expect(await results.hasPreviousPage()).toBe(false);
    expect(await results.hasNextPage()).toBe(true);
  });

  it("offset: can be combined with before cursor (last)", async () => {
    // before: Dimitri(6) → set is [Alan(5), Bernard(4), Cedric Anderson(3), Cedric Brown(2), Dimitri(1)]
    // offset:1, last:2 → skip Dimitri(1) from end → Cedric Anderson(3), Cedric Brown(2)
    const results = await sequelizeFindByCursor({
      attributes: ["firstName", "lastName", "id"],
      model: userModel,
      last: 2,
      offset: 1,
      before: {
        id: 6,
        firstName: "Dimitri",
        lastName: "LastName",
      },
      order: [
        ["firstName", "ASC"],
        ["lastName", "ASC"],
      ],
    });

    expect(results.nodes).toMatchSnapshot("nodes");
    expect(await results.hasPreviousPage()).toBe(true);
    expect(await results.hasNextPage()).toBe(true);
  });

  it("offset: can be combined with before cursor (first)", async () => {
    // before: Dimitri(6) → set is [Alan(5), Bernard(4), Cedric Anderson(3), Cedric Brown(2), Dimitri(1)]
    // offset:1, first:2 → skip Alan(5) → Bernard(4), Cedric Anderson(3)
    const results = await sequelizeFindByCursor({
      attributes: ["firstName", "lastName", "id"],
      model: userModel,
      first: 2,
      offset: 1,
      before: {
        id: 6,
        firstName: "Dimitri",
        lastName: "LastName",
      },
      order: [
        ["firstName", "ASC"],
        ["lastName", "ASC"],
      ],
    });

    expect(results.nodes).toMatchSnapshot("nodes");
    expect(await results.hasPreviousPage()).toBe(true);
    expect(await results.hasNextPage()).toBe(true);
  });

  it("offset: offset beyond available items returns empty result", async () => {
    // 6 total items, offset:10, first:2 → nothing to return
    const results = await sequelizeFindByCursor({
      attributes: ["firstName", "lastName", "id"],
      model: userModel,
      first: 2,
      offset: 10,
      order: [
        ["firstName", "ASC"],
        ["lastName", "ASC"],
      ],
    });

    expect(results.nodes).toHaveLength(0);
    expect(await results.hasPreviousPage()).toBe(true);
    expect(await results.hasNextPage()).toBe(false);
  });

  it("offset: offset=0 is equivalent to no offset (first)", async () => {
    const withOffset = await sequelizeFindByCursor({
      attributes: ["firstName", "lastName", "id"],
      model: userModel,
      first: 3,
      offset: 0,
      order: [
        ["firstName", "ASC"],
        ["lastName", "ASC"],
      ],
    });

    const withoutOffset = await sequelizeFindByCursor({
      attributes: ["firstName", "lastName", "id"],
      model: userModel,
      first: 3,
      order: [
        ["firstName", "ASC"],
        ["lastName", "ASC"],
      ],
    });

    expect(withOffset.nodes.map((n: any) => n.id)).toEqual(
      withoutOffset.nodes.map((n: any) => n.id),
    );
    expect(await withOffset.hasPreviousPage()).toBe(
      await withoutOffset.hasPreviousPage(),
    );
    expect(await withOffset.hasNextPage()).toBe(
      await withoutOffset.hasNextPage(),
    );
  });

  it("offset: throws when offset is negative", async () => {
    await expect(
      sequelizeFindByCursor({
        attributes: ["firstName", "lastName", "id"],
        model: userModel,
        first: 2,
        offset: -1,
        order: [["firstName", "ASC"]],
      }),
    ).rejects.toThrow(`'offset' must be a non-negative safe integer`);
  });

  describe("getTotalCount", () => {
    // Ordered set (by firstName ASC, lastName ASC, id ASC):
    // Alan(5), Bernard(4), Cedric Anderson(3), Cedric Brown(2), Dimitri LastName(1), Dimitri LastName(6)
    // Total = 6

    it("returns the total count of all records when no filter is applied", async () => {
      const results = await sequelizeFindByCursor({
        model: userModel,
        first: 2, // only fetches 2 nodes, but total should still be 6
        order: [["firstName", "ASC"]],
      });

      expect(await results.getTotalCount()).toBe(6);
    });

    it("respects the where filter but ignores cursor constraints", async () => {
      // birthDate >= 1990-01-01 matches: Alan(2000), Dimitri(1990), Dimitri(2010) → 3 records
      const results = await sequelizeFindByCursor({
        model: userModel,
        first: 1, // only fetches 1 node
        where: { birthDate: { [Op.gte]: "1990-01-01" } },
        order: [["firstName", "ASC"]],
      });

      expect(await results.getTotalCount()).toBe(3);
    });

    it("ignores after cursor (counts entire matching set, not the cursor-filtered subset)", async () => {
      // after: Cedric Anderson(3) normally filters to 3 records, but totalCount should still be 6
      const results = await sequelizeFindByCursor({
        model: userModel,
        first: 10,
        after: { id: 3, firstName: "Cedric", lastName: "Anderson" },
        order: [
          ["firstName", "ASC"],
          ["lastName", "ASC"],
        ],
      });

      expect(results.nodes).toHaveLength(3); // only 3 after the cursor
      expect(await results.getTotalCount()).toBe(6); // but total is still 6
    });

    it("ignores before cursor (counts entire matching set, not the cursor-filtered subset)", async () => {
      // before: Cedric Anderson(3) normally filters to 2 records, but totalCount should still be 6
      const results = await sequelizeFindByCursor({
        model: userModel,
        first: 10,
        before: { id: 3, firstName: "Cedric", lastName: "Anderson" },
        order: [
          ["firstName", "ASC"],
          ["lastName", "ASC"],
        ],
      });

      expect(results.nodes).toHaveLength(2); // only 2 before the cursor
      expect(await results.getTotalCount()).toBe(6); // but total is still 6
    });

    it("is lazily evaluated — does not query the DB until called", async () => {
      const countSpy = jest.spyOn(userModel, "count");

      await sequelizeFindByCursor({
        model: userModel,
        first: 2,
        order: [["firstName", "ASC"]],
      });

      expect(countSpy).not.toHaveBeenCalled();
      countSpy.mockRestore();
    });

    it("caches the result — only queries the DB once across multiple calls", async () => {
      const countSpy = jest.spyOn(userModel, "count");

      const results = await sequelizeFindByCursor({
        model: userModel,
        first: 2,
        order: [["firstName", "ASC"]],
      });

      const first = await results.getTotalCount();
      const second = await results.getTotalCount();

      expect(first).toBe(6);
      expect(second).toBe(6);
      expect(countSpy).toHaveBeenCalledTimes(1);
      countSpy.mockRestore();
    });
  });
});

afterAll(async () => {
  return sequelize.close();
});
