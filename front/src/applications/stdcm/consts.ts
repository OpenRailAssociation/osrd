const STDCM_REQUEST_STATUS = Object.freeze({
  idle: 'IDLE',
  pending: 'PENDING',
  success: 'SUCCESS',
  rejected: 'REJECTED',
  canceled: 'CANCELED',
  noresults: 'NORESULTS',
});

export default STDCM_REQUEST_STATUS;

export const RUNTIME_CAP = 43200;
