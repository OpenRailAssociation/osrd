import i18n from 'i18n';
import { isObject } from 'lodash';

import { ApiError } from 'common/api/baseGeneratedApis';

// function loadIfNeededI18NErrorsNamespace(): void {
//   if (!i18n.hasLoadedNamespace('errors')) {
//     i18n.loadNamespaces('errors');
//   }
// }

/**
 * Given an error, return the associated i18n name.
 * If name can't be found, a default one is return (or the default value specified)
 */
export function getErrorName(error: unknown, defaultValue?: string): string {
  let name = defaultValue || i18n.t('error', { ns: ['errors'] });
  if (isObject(error) && 'name' in error) {
    const i18nName = `${error.name}`;
    name = i18n.t(i18nName, i18nName, { ns: ['errors'] });
  }
  return name;
}

/**
 * Given an error, return the associated i18n message.
 * If message can't be found, a default one is return (or the default value specified)
 */
export function getErrorMessage(error: unknown, defaultValue?: string): string {
  let message = defaultValue || i18n.t('default', { ns: ['errors'] });
  if (isObject(error)) {
    // check if it's an APIError
    if ('data' in error && 'status' in error) {
      const { type, message: i18nMsg, context } = (error as ApiError).data;
      const i18nId = type.split(':').join('.');
      message = i18n.t(i18nId, i18nMsg, { ...context, ns: ['errors'] });
    }
    // Check if the object has a message prop (like standard Error)
    else if ('message' in error) {
      message = `${error.message}`;
    }
  }
  return message;
}

/**
 * Given an error, return it's status code.
 */
export function getErrorStatus(error: unknown): number | undefined {
  if (isObject(error) && 'status' in error) {
    return (error as ApiError).status;
  }
  return undefined;
}

/**
 * Given an error, it retuns an object that can be used with `setFailure`.
 * Ex: `setFailure(castErrorToFailure(e))`
 */
export function castErrorToFailure(
  error: unknown,
  defaultValue?: { name?: string; message?: string }
): { name: string; message: string } {
  if (error instanceof Error) console.error(error);

  return {
    name: getErrorName(error, defaultValue?.name),
    message: getErrorMessage(error, defaultValue?.message),
  };
}
