import type {
  ModelStatic,
  Model,
  NormalizedAttributeOptions,
} from "@sequelize/core";

export function getPrimaryAttributes<E extends Model>(
  model: ModelStatic<E>,
): Array<NormalizedAttributeOptions<E>> {
  const columns: Array<NormalizedAttributeOptions<E>> = [];

  for (const value of model.modelDefinition.attributes.values()) {
    if (value.primaryKey) {
      columns.push(value);
    }
  }

  return columns;
}

export function getUniqueColumns<E extends Model>(
  model: ModelStatic<E>,
): Array<Array<NormalizedAttributeOptions<E>>> {
  const uniqueAttributes: Array<Array<NormalizedAttributeOptions<E>>> = [];

  const { modelDefinition } = model;
  const attributes = modelDefinition.attributes;

  for (const index of modelDefinition.getIndexes()) {
    if (!index.unique) {
      continue;
    }

    // We only support string indexes
    if (!index.fields?.every((field) => typeof field === "string")) {
      continue;
    }

    const indexAttributes = index.fields.map((columnName) => {
      return find(
        attributes.values(),
        (attr) => attr.columnName === columnName,
      );
    });

    const filteredAttributes = indexAttributes.filter(
      (attr): attr is NonNullable<typeof attr> => attr !== undefined,
    ) as NormalizedAttributeOptions<E>[];

    if (filteredAttributes.length !== indexAttributes.length) {
      continue;
    }

    uniqueAttributes.push(filteredAttributes);
  }

  return uniqueAttributes;
}

/**
 * @param {string} column The possible association reference string
 * @returns {null | [string, string]} an array of [associationName, associationColumn] if the provided parameter is an association reference,
 * that is a string following the format '$associationName.associationColumn$
 */
export function matchAssociationReference(
  column: string,
): null | [string, string] {
  const match = column.match(/^\$([^.]+)\.(.+)\$$/);

  if (!match) {
    return null;
  }

  return [match[1], match[2]];
}

export function find<Val>(
  iterable: Iterable<Val>,
  cb: (item: Val) => boolean,
): Val | undefined {
  for (const item of iterable) {
    if (cb(item)) {
      return item;
    }
  }

  return undefined;
}
