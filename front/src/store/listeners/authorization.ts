import { isRejectedWithValue, type PayloadAction } from '@reduxjs/toolkit';
import { type FetchBaseQueryError } from '@reduxjs/toolkit/query';

import { type AppStartListening } from './types';

export default function add403HttpErrorListener(startListening: AppStartListening) {
  startListening({
    matcher: isRejectedWithValue,
    effect: (action: PayloadAction<unknown>) => {
      const error = action.payload as FetchBaseQueryError;
      if (error?.status === 403) {
        window.location.href = '/403';
      }
    },
  });
}
