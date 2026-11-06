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
} as const;

/** Identities of the e2e test users, as created by `scripts/load-e2e-users.sh`. */
export const E2E_USER_IDENTITIES = {
  projectOutsider: 'e2e/project-outsider',
  stdcmOnly: 'e2e/stdcm-only',
  noRole: 'e2e/no-role',
} as const;
