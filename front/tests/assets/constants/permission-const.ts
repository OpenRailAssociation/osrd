import { readJsonFile } from '../../utils/file-utils';

/**
 * Names of the e2e test users, created by `scripts/load-e2e-users.sh`.
 * Names must not match each other's search, so they are prefixed with `E2E` and use distinct words.
 */
export const E2E_USERS = {
  /** OperationalStudies role only */
  projectOutsider: 'E2E Project Outsider',
  /** Stdcm role only */
  stdcmOnly: 'E2E Stdcm Only',
  /** No role */
  noRole: 'E2E No Role',
  /** OperationalStudies and Stdcm roles, creates the infrastructures and rolling stocks */
  owner: 'E2E Owner',
  /** OperationalStudies and Stdcm roles, receives the write grant */
  writer: 'E2E Writer',
  /** OperationalStudies and Stdcm roles, receives the read grant */
  reader: 'E2E Reader',
  /** OperationalStudies and Stdcm roles, receives the restricted read grant */
  limited: 'E2E Limited',
  /** OperationalStudies and Stdcm roles, receives no grant */
  stranger: 'E2E Stranger',
  /** OperationalStudies role, only gets access through E2E_GROUP */
  groupMember: 'E2E Group Member',
} as const;

/** Identities of the e2e test users, sent in the `x-impersonate` header of the API requests */
export const E2E_IDENTITIES: Record<keyof typeof E2E_USERS, string> = {
  projectOutsider: 'e2e/project-outsider',
  stdcmOnly: 'e2e/stdcm-only',
  noRole: 'e2e/no-role',
  owner: 'e2e/owner',
  writer: 'e2e/writer',
  reader: 'e2e/reader',
  limited: 'e2e/limited',
  stranger: 'e2e/stranger',
  groupMember: 'e2e/group-member',
};

/** Group whose only member is E2E_USERS.groupMember */
export const E2E_GROUP = 'e2e-group';

const {
  authorization: { grants, yourGrant },
} = readJsonFile<{ authorization: { grants: Record<string, string>; yourGrant: string } }>(
  'public/locales/fr/translation.json'
);

/** Labels of the grants, as displayed by the grant manager */
export const GRANT_LABELS = {
  restrictedRead: grants.restricted_read,
  read: grants.read,
  write: grants.edit,
  full: grants.full,
};

export const getUserGrantText = (grantLabel: string) => yourGrant.replace('{{grant}}', grantLabel);
