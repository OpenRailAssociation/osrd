import { isRejectedWithValue, type PayloadAction } from '@reduxjs/toolkit';
import { type FetchBaseQueryError } from '@reduxjs/toolkit/query';

import type { osrdEditoastApi } from 'common/api/osrdEditoastApi';

import { type AppStartListening } from './types';

type EditoastEndpointName = keyof typeof osrdEditoastApi.endpoints;

type RTKQueryRejectedAction = PayloadAction<
  FetchBaseQueryError,
  string,
  {
    arg: {
      endpointName: EditoastEndpointName;
    };
  }
>;

/**
 * Endpoints for which a 403 response should NOT trigger a global redirect.
 * Add an endpoint name here when a 403 is expected and handled locally.
 */
const ENDPOINTS_SKIP_403_REDIRECT = new Set<EditoastEndpointName>([
  'getRollingStockNameByRollingStockName',
  'getTrainSchedulesByIdPath',
]);

export default function add403HttpErrorListener(startListening: AppStartListening) {
  startListening({
    matcher: isRejectedWithValue,
    effect: (action) => {
      const { payload: error, meta } = action as RTKQueryRejectedAction;
      if (error?.status === 403 && !ENDPOINTS_SKIP_403_REDIRECT.has(meta.arg.endpointName)) {
        window.location.href = '/403';
      }
    },
  });
}
