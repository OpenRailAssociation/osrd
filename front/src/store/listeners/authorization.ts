import { isRejectedWithValue, type PayloadAction } from '@reduxjs/toolkit';
import { type FetchBaseQueryError } from '@reduxjs/toolkit/query';

import { type AppStartListening } from './types';

type RTKQueryRejectedAction = PayloadAction<
  FetchBaseQueryError,
  string,
  {
    arg: {
      endpointName: string;
      originalArgs?: {
        __skipGlobal403?: boolean;
      };
    };
  }
>;

export default function add403HttpErrorListener(startListening: AppStartListening) {
  startListening({
    matcher: isRejectedWithValue,
    effect: (action) => {
      const { payload: error, meta } = action as RTKQueryRejectedAction;
      const skipGlobal403 = meta.arg.originalArgs?.__skipGlobal403;
      if (error?.status === 403 && !skipGlobal403) {
        window.location.href = '/403';
      }
    },
  });
}
