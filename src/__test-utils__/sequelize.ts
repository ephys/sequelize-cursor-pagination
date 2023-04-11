import type { Options } from '@sequelize/core';

export const TEST_databaseCredentials: Options = {
  dialect: 'postgres',
  port: 19_132,
  host: '0.0.0.0',
  password: 'password',
  username: 'user',
  database: 'db',
  logging: false,
};
