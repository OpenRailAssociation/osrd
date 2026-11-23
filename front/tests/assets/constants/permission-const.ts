import type { Role } from 'common/api/osrdEditoastApi';

/**
 * Names of the e2e test users, created through the editoast API during the global setup.
 */
export const E2E_USERS = {
  /** OperationalStudies role only */
  projectOutsider: 'E2E Project Outsider',
  /** Stdcm role only */
  stdcmOnly: 'E2E Stdcm Only',
  /** No role */
  noRole: 'E2E No Role',
} as const;

/** Identities of the e2e test users, created through the editoast API during the global setup. */
export const E2E_USER_IDENTITIES = {
  projectOutsider: 'e2e/project-outsider',
  stdcmOnly: 'e2e/stdcm-only',
  noRole: 'e2e/no-role',
} as const;

/** Roles of the e2e test users. */
export const E2E_USER_ROLES: Record<keyof typeof E2E_USERS, Role[]> = {
  projectOutsider: ['OperationalStudies'],
  stdcmOnly: ['Stdcm'],
  noRole: [],
};
