// The order is important here, as it is used to determine the order of the grants
export enum GRANTS_LABEL {
  NONE = 'none',
  READER = 'read',
  WRITER = 'edit',
  OWNER = 'full',
}

export enum SUBJECT_TYPES {
  USER = 'User',
  GROUP = 'Group',
}
