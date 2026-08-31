// The order is important here, as it is used to determine the order of the grants
export enum GRANTS_LABEL {
  NONE = 'none',
  // TODO_GRANT: Able RESTRICTED_READER when backend supports it
  // RESTRICTED_READER = 'restricted_read',
  READER = 'read',
  WRITER = 'edit',
  OWNER = 'full',
}

export enum SUBJECT_TYPES {
  USER = 'User',
  GROUP = 'Group',
}
