import type {
  GetAuthzByResourceTypeAndResourceIdApiResponse,
  InfraGrant,
  InfraPrivilege,
  ResourceType as ResourceTypeApi,
} from 'common/api/osrdEditoastApi';

import type { SUBJECT_TYPES } from './consts';

export type SubjectType = `${SUBJECT_TYPES}`;
export type Grant = InfraGrant;
export type ResourceType = ResourceTypeApi;
export type Subject = Omit<GetAuthzByResourceTypeAndResourceIdApiResponse['subjects'][0], 'grant'>;
export type SubjectWithGrant = Subject & { grant: Grant };
export type Privilege = InfraPrivilege;
