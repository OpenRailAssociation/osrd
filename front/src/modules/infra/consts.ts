import type { Grant } from 'common/api/mock/mockEditoastApi';

export enum GrantsLabel {
  NONE = 'none',
  READER = 'read',
  WRITER = 'edit',
  OWNER = 'full',
}

export const DEFAULT_GRANT: Grant = 'NONE';
