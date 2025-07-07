import type { TFunction } from 'i18next';
import type { JSONSchema7, JSONSchema7Definition } from 'json-schema';

export function translateProperties(
  propertiesList: {
    [key: string]: JSONSchema7Definition;
  },
  defName: string,
  t: TFunction
) {
  return Object.keys(propertiesList).reduce<{
    [key: string]: JSONSchema7;
  }>((propertiesAcc, property) => {
    const currentProperty = propertiesList[property] as JSONSchema7;
    const currentDescriptionKey = `${defName}.properties.${property}.description`;
    const currentTitleKey = `${defName}.properties.${property}.title`;

    return {
      ...propertiesAcc,
      [property]: {
        ...currentProperty,
        ...(currentProperty.description && {
          description: t(`infraEditor:${currentDescriptionKey}`),
        }),
        ...(currentProperty.title && {
          title: t(`infraEditor:${currentTitleKey}`),
        }),
      },
    };
  }, {});
}

export function translateDefinitions(
  defsList: { [key: string]: JSONSchema7Definition },
  t: TFunction
) {
  return Object.keys(defsList).reduce<{
    [key: string]: JSONSchema7;
  }>((acc, defName) => {
    const currentEntity = defsList[defName] as JSONSchema7;
    const properties =
      currentEntity.properties && translateProperties(currentEntity.properties, defName, t);

    const hideText = defName.includes('Extension');

    return {
      ...acc,
      [defName]: {
        ...currentEntity,
        ...(currentEntity.description && {
          description: hideText ? '' : t(`infraEditor:${defName}.description`),
        }),
        ...(currentEntity.title && {
          title: hideText ? '' : t(`infraEditor:${defName}.title`),
        }),
        ...(currentEntity.properties && { properties }),
      },
    };
  }, {});
}

export function translateSchema(schema: JSONSchema7, t: TFunction) {
  const translatedSchemaDefs = schema.$defs && translateDefinitions(schema.$defs, t);

  const translatedSchemaEntity =
    translatedSchemaDefs && schema.title && translatedSchemaDefs[schema.title];
  return {
    ...translatedSchemaEntity,
    $defs: translatedSchemaDefs,
    properties:
      schema.properties && schema.title && translateProperties(schema.properties, schema.title, t),
    required: schema.required,
  } as JSONSchema7;
}
