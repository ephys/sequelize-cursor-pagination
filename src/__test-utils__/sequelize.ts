import type { Options } from "@sequelize/core";
import type { PostgresDialect } from "@sequelize/postgres";

export const TEST_databaseCredentials: Options<PostgresDialect> = {
  dialect: "postgres",
  port: 19_132,
  host: "0.0.0.0",
  password: "password",
  user: "user",
  database: "db",
  logging: false,
};
