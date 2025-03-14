import type { Role } from 'common/api/osrdEditoastApi';

export type RequiredUserRolesFor = {
  VIEWS: {
    OPERATIONAL_STUDIES: Role[];
    STDCM: Role[];
    INFRA_EDITOR: Role[];
    MAP: Role[];
    ROLLING_STOCK_EDITOR: Role[];
  };
  USER_PROFILE: {
    STDCM: Role[];
    OPERATIONAL_STUDIES: Role[];
  };
  FEATURES: {
    ACCESS_STDCM_DEBUG: Role[];
    CREATE_NEW_PROJECT_STUDY_SCENARIO: Role[];
  };
};

export const REQUIRED_USER_ROLES_FOR: RequiredUserRolesFor = {
  VIEWS: {
    STDCM: ['Stdcm'],
    OPERATIONAL_STUDIES: ['OperationalStudies'],
    INFRA_EDITOR: ['OperationalStudies'],
    MAP: ['OperationalStudies', 'Stdcm'],
    ROLLING_STOCK_EDITOR: ['OperationalStudies'],
  },
  USER_PROFILE: {
    STDCM: ['Stdcm'],
    OPERATIONAL_STUDIES: ['OperationalStudies'],
  },
  FEATURES: {
    ACCESS_STDCM_DEBUG: ['Admin'],
    CREATE_NEW_PROJECT_STUDY_SCENARIO: ['OperationalStudies'],
  },
};
