import type { ModelStatic } from '@sequelize/core';
import { DataTypes, Sequelize } from '@sequelize/core';
// eslint-disable-next-line no-restricted-imports
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { TEST_databaseCredentials } from './__test-utils__/sequelize.js';
import { getPrimaryAttributes, getUniqueColumns } from './sequelize-utils.js';

let sequelize: Sequelize;
let model: ModelStatic<any>;
let compositePkModel: ModelStatic<any>;

before(async () => {
  sequelize = new Sequelize(TEST_databaseCredentials);

  model = sequelize.define(
    'User',
    {
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
    },
    {
      indexes: [
        {
          type: 'UNIQUE',
          fields: ['optionsUnique'],
        },
      ],
    },
  );

  compositePkModel = sequelize.define('CompositePkUser', {
    id1: {
      type: DataTypes.INTEGER,
      primaryKey: true,
    },
    id2: {
      type: DataTypes.INTEGER,
      primaryKey: true,
    },
  });

  await sequelize.sync({
    force: true,
  });
});

describe('getUniqueColumns', () => {
  it('returns all unique columns', () => {
    const out = getUniqueColumns(model);
    // TODO: expect ['optionsUnique'] too
    assert.deepStrictEqual(
      out.map((group) => group.map((col) => col.columnName)),
      [
        ['optionsUnique'],
        ['externalId'],
        ['compositeUnique1', 'compositeUnique2'],
      ],
    );
  });
});

describe('getPrimaryColumns', () => {
  it('returns all PK columns', () => {
    assert.deepStrictEqual(
      getPrimaryAttributes(model).map((col) => col.columnName),
      ['id'],
    );
    assert.deepStrictEqual(
      getPrimaryAttributes(compositePkModel).map((col) => col.columnName),
      ['id1', 'id2'],
    );
  });
});

after(async () => {
  await sequelize.close();
});
