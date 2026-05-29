import type {
  GetAuthzByResourceTypeAndResourceIdApiResponse,
  StandardGrant,
  StandardPrivilege,
  ResourceType as ResourceTypeApi,
} from 'common/api/osrdEditoastApi';

import type { SUBJECT_TYPES } from './consts';

export type SubjectType = `${SUBJECT_TYPES}`;
export type Grant = StandardGrant;
export type ResourceType = ResourceTypeApi;
export type Subject = Omit<GetAuthzByResourceTypeAndResourceIdApiResponse[0], 'grant'>;
export type SubjectWithGrant = Subject & { grant: Grant };
export type Privilege = StandardPrivilege;
