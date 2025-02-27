export enum InfraLockState {
  LOCK,
  UNLOCK,
}

export enum GrantsLabel {
  NONE = 'none',
  READER = 'read',
  WRITER = 'edit',
  OWNER = 'full',
}

export const DEFAULT_GRANT = 'NONE';
