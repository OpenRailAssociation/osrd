import { SerializedError } from '@reduxjs/toolkit';
import { ApiError } from 'common/api/emptyApi';

// eslint-disable-next-line import/prefer-default-export
export const extractMessageFromError = (error: ApiError | SerializedError) =>
  `${(error as ApiError)?.data?.message || (error as SerializedError)?.message}`;
