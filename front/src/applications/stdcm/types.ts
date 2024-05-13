import type STDCM_REQUEST_STATUS from 'applications/stdcm/consts';
import type { PostV2TimetableByIdStdcmApiResponse } from 'common/api/osrdEditoastApi';
import type { ValueOf } from 'utils/types';

export type StdcmRequestStatus = ValueOf<typeof STDCM_REQUEST_STATUS>;

export type StdcmV2SuccessResponse = Extract<
  PostV2TimetableByIdStdcmApiResponse,
  { status: 'success' }
>;
