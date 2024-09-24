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
  const i18nErrors: string[] = [];

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
        i18nErrors.push(
          `Error "${errorName}" has missing i18n message. Please add the key "${errorId}" to the file "${i18n_error_path}"`
        );
      },
      missingInterpolationHandler: (_text, value) => {
        const varName = `${value[0]}`;
        // Due to the dummy variable (see comment on `errorVarExample`), if we use a key of a property object
        // the test will fail here. That's why we check here if the var  name used in the message contains a "."
        if (!varName.includes('.')) {
          i18nErrors.push(
            `Message for error "${errorName}" is using an unknown variable ${value[0]}`
          );
        }
      },
    },
    noop
  );

  // Generate the error message
  i18n.t(errorId, errorVarExample);

  return i18nErrors;
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
