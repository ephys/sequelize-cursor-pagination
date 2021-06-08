import type {
  ModelCtor as ModelType,
  Model,
} from 'sequelize';

export function getPrimaryColumns<E extends Model>(model: ModelType<E>) {
  const columns = [];

  for (const value of Object.values(model.rawAttributes)) {
    if (value.primaryKey) {
      columns.push(value);
    }
  }

  return columns;
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
