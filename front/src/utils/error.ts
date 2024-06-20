import { isObject } from 'lodash';

import type { ApiError } from 'common/api/baseGeneratedApis';
import i18n from 'i18n';

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
  const defaultMessage = defaultValue || i18n.t('default', { ns: ['errors'] });
  if (!isObject(error)) {
    return defaultMessage;
  }

  // Check if it's an APIError
  if ('data' in error && 'status' in error) {
    if (isObject(error.data)) {
      const { type, message: i18nMsg, context } = (error as ApiError).data;
      const i18nId = type.split(':').join('.');
      return i18n.t(i18nId, i18nMsg, { ...context, ns: ['errors'] });
    }
    if (typeof error.data === 'string') {
      // API returned a plaintext error instead of a JSON payload
      return error.data;
    }
  }

  // Check if the object has a message prop (like standard Error)
  if ('message' in error) {
    return `${error.message}`;
  }

  // Didn't find anything better than the default generic error message
  return defaultMessage;
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
