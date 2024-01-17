import { SerializedError } from '@reduxjs/toolkit';

import { ApiError } from 'common/api/baseGeneratedApis';
import i18n from 'i18n';

// eslint-disable-next-line import/prefer-default-export
export const extractMessageFromError = (error: ApiError | SerializedError | Error): string => {
  let message = i18n.t('default', { ns: ['errors'] });
  if ('data' in error) {
    const { type, context } = error.data;
    const i18nId = type.split(':').join('.');
    message = i18n.t(i18nId, error.data.message, { context, ns: ['errors'] });
  } else if (error.message) {
    message = error.message;
  }
  return message;
};

export const extractStatusFromError = (error: ApiError) => (error as ApiError)?.status;
