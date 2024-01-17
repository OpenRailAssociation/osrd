import SwaggerParser from '@apidevtools/swagger-parser';
import i18next from 'i18next';
import { noop } from 'lodash';

// relative the project's root
const openapi_path = '../editoast/openapi.yaml';
// relative to this file
const i18n_error_path = '../public/locales/fr/errors.json';

/**
 * Check if the given error is well filled in the i18n.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function checkI18N(error: any): Promise<string[]> {
  const result: string[] = [];

  // Error data for i18n
  const errorName = error.properties.type.enum[0];
  const errorId = errorName.split(':').join('.');
  const errorVarExample = Object.keys(error.properties.context.properties || {}).reduce(
    (acc, curr) => {
      acc[curr] = '';
      return acc;
    },
    {} as Record<string, string>
  );

  // Init the i18n system
  const i18nData = require(i18n_error_path);
  const i18n = await i18next.createInstance(
    {
      lng: 'fr',
      resources: {
        fr: {
          translation: i18nData,
        },
      },
      parseMissingKeyHandler: () => {
        result.push(
          `Error "${errorName}" has missing i18n message. Please add the key "${errorId}" to the file "${i18n_error_path}"`
        );
      },
      missingInterpolationHandler: (_text, value) => {
        result.push(`Message for error "${errorName}" is using an unknown variable ${value[0]}`);
      },
    },
    noop
  );

  // Generate the error message
  i18n.t(errorId, errorVarExample);

  return result;
}

async function run() {
  try {
    const api = await SwaggerParser.validate(openapi_path);

    // Do some checks on the generic error
    if (!api.components.schemas.EditoastError)
      throw new Error(`"EditoastError" can't be found in "components > schemas"`);
    if (!api.components.schemas.EditoastError.oneOf)
      throw new Error(`Expected "EditoastError" to be a "oneOf" object`);

    // Check i18n for all errors
    const errors = (
      await Promise.all(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        api.components.schemas.EditoastError.oneOf.map((error: any) => checkI18N(error))
      )
    ).flat();

    if (errors.length > 0) {
      console.log(errors);
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
