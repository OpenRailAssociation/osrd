import fs from 'node:fs';

import SwaggerParser from '@apidevtools/swagger-parser';
import i18next from 'i18next';
import type { OpenAPI, OpenAPIV3, OpenAPIV3_1 } from 'openapi-types';

// relative the project's root
const openapi_path = '../editoast/openapi.yaml';
// relative to this file
const i18n_error_path = '../public/locales/{locale}/errors.json';
const checkedLocales = ['en', 'fr'];

/**
 * Check if the given error is well filled in the i18n.
 */
async function checkI18N(
  error:
    | OpenAPIV3_1.SchemaObject
    | OpenAPIV3.ReferenceObject
    | OpenAPIV3.SchemaObject
    | OpenAPIV3_1.ReferenceObject
): Promise<string[]> {
  const i18nErrors: string[] = [];

  // If needed, we could resolve the refs instead of throwing (and the same is true for context)
  if ('$ref' in error) {
    throw new Error(
      `Invalid error schema: reference found instead of schema for "${JSON.stringify(error)}".`
    );
  }

  if (
    !(
      error.properties &&
      'enum' in error.properties?.type &&
      Array.isArray(error.properties.type.enum) &&
      error.properties.type.enum.length !== 0 &&
      typeof error.properties.type.enum[0] === 'string'
    )
  ) {
    throw new Error(
      `Invalid error schema: properties.type.enum missing or invalid in "${JSON.stringify(error)}".`
    );
  }

  if ('$ref' in error.properties.context) {
    throw new Error(
      `Invalid error schema: reference found instead of schema in properties.context for "${JSON.stringify(error)}".`
    );
  }

  // Error data for i18n
  const errorName = error.properties.type.enum[0];
  const errorId = errorName.split(':').join('.');
  // This variable is used for testing the generation of the error message.
  // It's a dummy (and dumb) error variables, it just generate an object with empty string
  // perhaps we can find a better way to generate it, specially this the property type
  const errorVarExample = Object.keys(error.properties.context.properties || {}).reduce(
    (acc, curr) => {
      acc[curr] = '';
      return acc;
    },
    {} as Record<string, string>
  );

  for (const locale of checkedLocales) {
    const localized_i18n_error_path = i18n_error_path.replace('{locale}', locale);
    const i18nData = JSON.parse(
      fs.readFileSync(new URL(localized_i18n_error_path, import.meta.url), 'utf8')
    );
    // Init the i18n system
    const i18n = await i18next.createInstance(
      {
        lng: locale,
        resources: {
          [locale]: {
            translation: i18nData,
          },
        },
        parseMissingKeyHandler: () => {
          i18nErrors.push(
            `Error "${errorName}" has missing i18n message. Please add the key "${errorId}" to the file "${localized_i18n_error_path}"`
          );
        },
        missingInterpolationHandler: (_text, value) => {
          const varName = `${value[0]}`;
          // Due to the dummy variable (see comment on `errorVarExample`), if we use a key of a property object
          // the test will fail here. That's why we check here if the var  name used in the message contains a "."
          if (!varName.includes('.')) {
            i18nErrors.push(
              `Message for error "${errorName}" in the file "${localized_i18n_error_path}" is using an unknown variable ${value[0]}`
            );
          }
        },
      },
      () => {}
    );

    // Generate the error message
    i18n.t(errorId, errorVarExample);
  }

  return i18nErrors;
}

async function run() {
  try {
    const api: OpenAPI.Document = await SwaggerParser.validate(openapi_path);

    if (!('openapi' in api)) throw new Error('Expected an OpenAPI schema');

    // Do some checks on the generic error
    const editoastError = api?.components?.schemas?.EditoastError;
    if (!editoastError) throw new Error(`"EditoastError" can't be found in "components > schemas"`);
    if (!('oneOf' in editoastError) || !editoastError.oneOf)
      throw new Error(`Expected "EditoastError" to be a "oneOf" object`);

    // Check i18n for all errors
    const errors = (await Promise.all(editoastError.oneOf.map((error) => checkI18N(error)))).flat();

    if (errors.length > 0) {
      console.error(errors);
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error(err);
    process.exit(1);
  } finally {
    process.exit();
  }
}

run();
