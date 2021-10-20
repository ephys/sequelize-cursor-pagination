import type {
  ModelCtor as ModelType,
  Model,
  ModelAttributeColumnOptions,
} from 'sequelize';

type Column<E extends Model> = ModelAttributeColumnOptions<E>;

export function getPrimaryColumns<E extends Model>(model: ModelType<E>): Array<Column<E>> {
  const columns: Array<Column<E>> = [];

  for (const value of Object.values(model.rawAttributes)) {
    if (value.primaryKey) {
      columns.push(value);
    }
  }

  return columns;
}

export function getUniqueColumns<E extends Model>(model: ModelType<E>): Array<Array<Column<E>>> {
  const compositeUniques: Map<string, Array<Column<E>>> = new Map();
  const singleUniques: Array<Column<E>> = [];

  for (const value of Object.values(model.rawAttributes)) {
    if (value.unique == null || value.unique === false) {
      continue;
    }

    if (value.unique === true) {
      singleUniques.push(value);
      continue;
    }

    const name = typeof value.unique === 'string' ? value.unique : value.unique.name;
    const compositeUnique = compositeUniques.get(name) ?? [];
    compositeUnique.push(value);
    compositeUniques.set(name, compositeUnique);
  }

  // TODO
  // for (const index of model.options.indexes) {
  //   if (!index.unique) {
  //     continue;
  //   }
  //
  //   index.fields
  // }

  return [
    ...compositeUniques.values(),
    ...singleUniques.map(v => [v]),
  ];
}

/**
 * @param {string} column The possible association reference string
 * @returns {null | [string, string]} an array of [associationName, associationColumn] if the provided parameter is an association reference,
 * that is a string following the format '$associationName.associationColumn$
 */
export function matchAssociationReference(column: string): null | [string, string] {
  const match = column.match(/^\$([^.]+)\.(.+)\$$/);

  if (!match) {
    return null;
  }

  return [match[1], match[2]];
}
