import type { ModelStatic } from '@sequelize/core';
import { DataTypes, Sequelize } from '@sequelize/core';
import { TEST_databaseCredentials } from './__test-utils__/sequelize';
import { getPrimaryAttributes, getUniqueColumns } from './sequelize-utils';

let sequelize: Sequelize;
let model: ModelStatic<any>;
let compositePkModel: ModelStatic<any>;

beforeAll(async () => {
  sequelize = new Sequelize(TEST_databaseCredentials);

  model = sequelize.define('users', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    optionsUnique: {
      type: DataTypes.STRING,
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
  }, {
    indexes: [{
      type: 'UNIQUE',
      fields: ['optionsUnique'],
    }],
  });

  compositePkModel = sequelize.define('users', {
    id1: {
      type: DataTypes.INTEGER,
      primaryKey: true,
    },
    id2: {
      type: DataTypes.INTEGER,
      primaryKey: true,
    },
  }, {});

  await sequelize.sync({
    force: true,
  });
});

describe('getUniqueColumns', () => {
  it('returns all unique columns', () => {
    const out = getUniqueColumns(model);
    // TODO: expect ['optionsUnique'] too
    expect(out.map(group => group.map(col => col.field))).toEqual([['optionsUnique'], ['externalId'], ['compositeUnique1', 'compositeUnique2']]);
  });
});

describe('getPrimaryColumns', () => {
  it('returns all PK columns', () => {
    expect(getPrimaryAttributes(model).map(col => col.field)).toEqual(['id']);
    expect(getPrimaryAttributes(compositePkModel).map(col => col.field)).toEqual(['id1', 'id2']);
  });
});

afterAll(async () => {
  return sequelize.close();
});
