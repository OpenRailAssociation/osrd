import type { BuiltinRole } from 'common/api/osrdEditoastApi';

export type RequiredUserRolesFor = {
  VIEWS: {
    OPERATIONAL_STUDIES: BuiltinRole[];
    STDCM: BuiltinRole[];
    INFRA_EDITOR: BuiltinRole[];
    MAP: BuiltinRole[];
    ROLLING_STOCK_EDITOR: BuiltinRole[];
  };
  USER_PROFILE: {
    STDCM: BuiltinRole[];
    OPERATIONAL_STUDIES: BuiltinRole[];
  };
  FEATURES: {
    ACCESS_STDCM_DEBUG: BuiltinRole[];
    CREATE_NEW_PROJECT_STUDY_SCENARIO: BuiltinRole[];
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
