import type { ModelCtor } from 'sequelize';
import { DataTypes, Op, Sequelize } from 'sequelize';
import { TEST_databaseCredentials } from './__test-utils__/sequelize';
import { sequelizeFindByCursor } from '.';

let sequelize: Sequelize;
let userModel: ModelCtor<any>;

// TODO: ensure hasPreviousPage, hasNextPage is returning the correct value.

beforeAll(async () => {
  sequelize = new Sequelize(TEST_databaseCredentials);

  userModel = sequelize.define('users', {
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
  }, {});

  await sequelize.sync({
    force: true,
  });

  await userModel.bulkCreate([{
    id: 5,
    externalId: 'A',
    compositeUnique1: 'A',
    compositeUnique2: '1',
    firstName: 'Alan',
    lastName: 'LastName',
    birthDate: '2000-01-01',
  }, {
    id: 4,
    externalId: 'B',
    compositeUnique1: 'A',
    compositeUnique2: '2',
    firstName: 'Bernard',
    lastName: 'LastName',
    birthDate: '1970-01-01',
  }, {
    id: 3,
    externalId: 'C',
    compositeUnique1: 'A',
    compositeUnique2: '3',
    firstName: 'Cedric',
    lastName: 'Anderson',
    birthDate: '1980-01-01',
  }, {
    id: 2,
    externalId: 'D',
    compositeUnique1: 'A',
    compositeUnique2: '4',
    firstName: 'Cedric',
    lastName: 'Brown',
    birthDate: '1960-01-01',
  }, {
    id: 6,
    externalId: 'E',
    compositeUnique1: 'A',
    compositeUnique2: '5',
    firstName: 'Dimitri',
    lastName: 'LastName',
    birthDate: '1990-01-01',
  }, {
    id: 1,
    externalId: 'F',
    compositeUnique1: 'A',
    compositeUnique2: '6',
    firstName: 'Dimitri',
    lastName: 'LastName',
    birthDate: '2010-01-01',
  }]);
});

describe('sequelizeFindByCursor', () => {
  it('includes PK in ORDER BY to ensures constant order', async () => {
    const results = await sequelizeFindByCursor({
      attributes: ['firstName', 'lastName', 'id'],
      model: userModel,
      first: 10,
      order: [['firstName', 'ASC'], ['lastName', 'ASC']],
      logging: query => {
        expect(query).toMatchSnapshot('query');
      },
    });

    // "Dimitri LastName" (1) should be before "Dimitri LastName" (6)

    expect(results.nodes).toMatchSnapshot('nodes');
    expect(await results.hasNextPage()).toBe(false);
    expect(await results.hasPreviousPage()).toBe(false);
  });

  it('does not include extra PK in ORDER BY if it’s already present', async () => {
    const results = await sequelizeFindByCursor({
      attributes: ['firstName', 'lastName', 'id'],
      model: userModel,
      first: 10,
      order: [['firstName', 'ASC'], ['lastName', 'ASC'], ['id', 'DESC']],
      logging: query => {
        expect(query).toMatchSnapshot('query');
      },
    });

    // "Dimitri LastName" (6) should be before "Dimitri LastName" (1)

    expect(results.nodes).toMatchSnapshot('nodes');
    expect(await results.hasNextPage()).toBe(false);
    expect(await results.hasPreviousPage()).toBe(false);
  });

  it('supports returning the first x elements of the set', async () => {
    const results = await sequelizeFindByCursor({
      attributes: ['firstName', 'lastName', 'id'],
      model: userModel,
      first: 2,
      order: [['firstName', 'ASC'], ['lastName', 'ASC']],
    });

    expect(results.nodes).toMatchSnapshot('nodes');
    expect(await results.hasNextPage()).toBe(true);
    expect(await results.hasPreviousPage()).toBe(false);
  });

  it('supports returning the last x elements of the set', async () => {
    const results = await sequelizeFindByCursor({
      attributes: ['firstName', 'lastName', 'id'],
      model: userModel,
      last: 2,
      order: [['firstName', 'ASC'], ['lastName', 'ASC']],
    });

    expect(results.nodes).toMatchSnapshot('nodes');
    expect(await results.hasNextPage()).toBe(false);
    expect(await results.hasPreviousPage()).toBe(true);
  });

  it('supports returning the first x elements after another cursor', async () => {
    const results = await sequelizeFindByCursor({
      attributes: ['firstName', 'lastName', 'id'],
      model: userModel,
      first: 2,
      after: {
        id: 3,
        firstName: 'Cedric',
        lastName: 'Anderson',
      },
      order: [['firstName', 'ASC'], ['lastName', 'ASC']],
    });

    expect(results.nodes).toMatchSnapshot('nodes');
    expect(await results.hasNextPage()).toBe(true);
    expect(await results.hasPreviousPage()).toBe(true);
  });

  it('supports returning the last x elements after another cursor', async () => {
    const results = await sequelizeFindByCursor({
      attributes: ['firstName', 'lastName', 'id'],
      model: userModel,
      last: 2,
      after: {
        id: 3,
        firstName: 'Cedric',
        lastName: 'Anderson',
      },
      order: [['firstName', 'ASC'], ['lastName', 'ASC']],
    });

    expect(results.nodes).toMatchSnapshot('nodes');
    expect(await results.hasNextPage()).toBe(false);
    expect(await results.hasPreviousPage()).toBe(true);
  });

  it('supports returning the first x elements before another cursor', async () => {
    const results = await sequelizeFindByCursor({
      attributes: ['firstName', 'lastName', 'id'],
      model: userModel,
      first: 2,
      before: {
        id: 3,
        firstName: 'Cedric',
        lastName: 'Anderson',
      },
      order: [['firstName', 'ASC'], ['lastName', 'ASC']],
    });

    expect(results.nodes).toMatchSnapshot('nodes');
    expect(await results.hasNextPage()).toBe(false);
    expect(await results.hasPreviousPage()).toBe(false);
  });

  it('supports returning the last x elements before another cursor', async () => {
    const results = await sequelizeFindByCursor({
      attributes: ['firstName', 'lastName', 'id'],
      model: userModel,
      last: 2,
      before: {
        id: 1,
        firstName: 'Dimitri',
        lastName: 'LastName',
      },
      order: [['firstName', 'ASC'], ['lastName', 'ASC']],
    });

    expect(results.nodes).toMatchSnapshot('nodes');
    expect(await results.hasNextPage()).toBe(true);
    expect(await results.hasPreviousPage()).toBe(true);
  });

  it('supports filtering', async () => {
    const results = await sequelizeFindByCursor({
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
      order: [['firstName', 'ASC'], ['lastName', 'ASC']],
      logging: sql => {
        expect(sql).toMatchSnapshot('query');
      },
    });

    expect(results.nodes).toMatchSnapshot('nodes');
    expect(await results.hasNextPage()).toBe(false);
    expect(await results.hasPreviousPage()).toBe(true);
  });

  it('returns the keys used for the cursor (no unique specified: adds PK)', async () => {
    const results = await sequelizeFindByCursor({
      attributes: ['firstName', 'id'],
      model: userModel,
      first: 10,
      order: [['firstName', 'ASC']],
    });

    expect(results.cursorKeys).toEqual(['firstName', 'id']);
  });

  it('returns the keys used for the cursor (Unique specified)', async () => {
    const results = await sequelizeFindByCursor({
      attributes: ['firstName', 'externalId'],
      model: userModel,
      first: 10,
      order: [['firstName', 'ASC'], ['externalId', 'ASC']],
    });

    expect(results.cursorKeys).toEqual(['firstName', 'externalId']);
  });

  it('returns the keys used for the cursor (Composite unique partly specified: adds PK)', async () => {
    const results = await sequelizeFindByCursor({
      attributes: ['firstName', 'compositeUnique1'],
      model: userModel,
      first: 10,
      order: [['firstName', 'ASC'], ['compositeUnique1', 'ASC']],
    });

    expect(results.cursorKeys).toEqual(['firstName', 'compositeUnique1', 'id']);
  });

  it('returns the keys used for the cursor (Composite unique fully specified)', async () => {
    const results = await sequelizeFindByCursor({
      attributes: ['firstName', 'compositeUnique1', 'compositeUnique2'],
      model: userModel,
      first: 10,
      order: [['firstName', 'ASC'], ['compositeUnique1', 'ASC'], ['compositeUnique2', 'ASC']],
    });

    expect(results.cursorKeys).toEqual(['firstName', 'compositeUnique1', 'compositeUnique2']);
  });
});

afterAll(async () => {
  return sequelize.close();
});
