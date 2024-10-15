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
    OPERATIONAL_STUDIES: ['OpsRead', 'OpsWrite'],
    INFRA_EDITOR: ['InfraWrite'],
    MAP: ['InfraRead', 'InfraWrite'],
    ROLLING_STOCK_EDITOR: ['RollingStockCollectionWrite'],
  },
  USER_PROFILE: {
    STDCM: [
      'Stdcm',
      'RollingStockCollectionRead',
      'WorkScheduleRead',
      'MapRead',
      'InfraRead',
      'DocumentRead',
      'TimetableRead',
    ],
    OPERATIONAL_STUDIES: [
      'OpsRead',
      'OpsWrite',
      'InfraRead',
      'InfraWrite',
      'MapRead',
      'RollingStockCollectionRead',
      'RollingStockCollectionWrite',
      'WorkScheduleRead',
      'TimetableRead',
      'TimetableWrite',
      'DocumentRead',
      'DocumentWrite',
    ],
  },
  FEATURES: {
    ACCESS_STDCM_DEBUG: ['Superuser'],
    CREATE_NEW_PROJECT_STUDY_SCENARIO: ['OpsWrite'],
  },
};
