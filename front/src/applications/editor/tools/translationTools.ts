import type { TFunction } from 'i18next';
import type { JSONSchema7, JSONSchema7Definition } from 'json-schema';

import i18n from 'i18n';

function getI18nTranslation(key: string, defaultTranslation: string, t: TFunction) {
  return i18n.exists(key) ? t(key) : defaultTranslation;
}

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
          description: getI18nTranslation(
            `infraEditor:${currentDescriptionKey}`,
            currentProperty.description,
            t
          ),
        }),
        ...(currentProperty.title && {
          title: getI18nTranslation(`infraEditor:${currentTitleKey}`, currentProperty.title, t),
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
          description: hideText
            ? ''
            : getI18nTranslation(
                `infraEditor:${defName}.description`,
                currentEntity.description,
                t
              ),
        }),
        ...(currentEntity.title && {
          title: hideText
            ? ''
            : getI18nTranslation(`infraEditor:${defName}.title`, currentEntity.title, t),
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
