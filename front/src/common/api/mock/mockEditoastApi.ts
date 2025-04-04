import { compact, keyBy } from 'lodash';

import type { SUBJECT_TYPES } from 'common/authorization/consts';

import { baseGatewayApi as api } from '../baseGeneratedApis';
import database from './mockData';

const mockedEditoastApi = api.injectEndpoints({
  endpoints: (build) => ({
    getSubjects: build.query<GetSubjectsResponse, void>({
      // url: /subjects
      queryFn: () => ({
        data: database.SUBJECTS.map((subject) => ({
          id: subject.id,
          name: subject.name,
          type: subject.type,
        })),
      }),
    }),
    getGrantsByResourceType: build.query<
      GetGrantsByResourceTypeResponse,
      GetGrantsByResourceTypeArg
    >({
      // url: /authz/grants/${queryArg.resource_type}
      queryFn: () => ({
        data: database.GRANTS,
      }),
    }),
    getUserInfos: build.query<GetUserResponse, void>({
      // url: /authz/me
      queryFn: () => ({
        data: {
          id: database.SUBJECTS[0].id,
          name: database.SUBJECTS[0].name,
          roles: database.SUBJECTS[0].roles,
        },
      }),
    }),
    // TODO: invalidate the cache when infra liste changed after (creation/deletion) ?
    /** Returns the user's grants for a given list of resources */
    postUserResourcesGrants: build.mutation<
      PostUserResourcesGrantsResponse,
      PostUserResourcesGrantsArg
    >({
      // url: /authz/me/grants
      queryFn: (resourcesIdByType) => {
        const response = Object.entries(resourcesIdByType).reduce<PostUserResourcesGrantsResponse>(
          (acc, [resourceType, resourceIds]) => {
            const resourcesGranted =
              database.SUBJECTS[0].resourcesGranted[resourceType as ResourceType];
            acc[resourceType as ResourceType] = compact(
              resourceIds.map((resourceId) =>
                resourcesGranted.find((resource) => resource.id === resourceId)
              )
            );
            return acc;
          },
          {}
        );

        return { data: response };
      },
    }),
    /** Returns the grants for each specified user on a given resource */
    postUsersGrantsByResourceId: build.mutation<
      PostUsersGrantsByResourceIdResponse,
      PostUsersGrantsByResourceIdArg
    >({
      // url: /authz/{resource_type}/{resource_id}
      queryFn: (queryArgs) => {
        const { subjects_id, resource_type, resource_id } = queryArgs;
        const usersById = keyBy(database.SUBJECTS, 'id');

        const response = subjects_id.reduce<PostUsersGrantsByResourceIdResponse>((acc, id) => {
          const user = usersById[id];
          const userGrant = user.resourcesGranted[resource_type].find(
            (resource) => resource.id === resource_id
          )?.grant;
          if (userGrant) {
            acc.push({
              type: user.type,
              id: user.id,
              grant: userGrant,
            });
          }
          return acc;
        }, []);

        return {
          data: response,
        };
      },
    }),
    /** New Version of the postUsersGrantsByResourceId query */
    getUsersGrantsByResourceId: build.query<
      GetUsersGrantsByResourceIdResponse,
      GetUsersGrantsByResourceIdArg
    >({
      // url: /authz/{resource_type}/{resource_id}
      queryFn: (queryArgs) => {
        const { resource_type, resource_id } = queryArgs;

        const response = database.SUBJECTS.filter((user) =>
          user.resourcesGranted[resource_type].some((resource) => resource.id === resource_id)
        ).map((user) => ({
          type: user.type,
          id: user.id,
          name: user.name,
          grant: user.resourcesGranted[resource_type].find(
            (resource) => resource.id === resource_id
          )!.grant,
        }));

        return {
          data: { subjects: response },
        };
      },
    }),
  }),
});

// ------------------ TYPES --------------------

export type ResourceType = 'infra' | 'timetable';

export type Grant = 'READER' | 'WRITER' | 'OWNER';

export type Privilege =
  | 'can_read'
  | 'can_share_read'
  | 'can_write'
  | 'can_share_write'
  | 'can_delete'
  | 'can_share_ownership';

export type PrivilegesByGrant = Record<Grant, Privilege[]>;

export type SubjectType = `${SUBJECT_TYPES}`;

export type MockedDB = {
  SUBJECTS: {
    type: SubjectType;
    name: string;
    id: number;
    roles: string[];
    resourcesGranted: {
      [key in ResourceType]: { id: number; grant: Grant }[];
    };
  }[];
  GRANTS: PrivilegesByGrant;
};

export type GetSubjectsResponse = { type: string; id: number; name: string }[];

type GetGrantsByResourceTypeArg = ResourceType;

export type GetGrantsByResourceTypeResponse = PrivilegesByGrant;

type GetUserResponse = { id: number; name: string; roles: string[] };

type PostUserResourcesGrantsArg = Partial<Record<ResourceType, number[]>>;
type PostUserResourcesGrantsResponse = {
  [resource_type: string]: {
    id: number;
    grant: Grant;
  }[];
};

type PostUsersGrantsByResourceIdArg = {
  subjects_id: number[];
  resource_type: ResourceType;
  resource_id: number;
};
export type PostUsersGrantsByResourceIdResponse = {
  id: number;
  type: SubjectType;
  grant: Grant;
}[];

type GetUsersGrantsByResourceIdArg = {
  resource_type: ResourceType;
  resource_id: number;
};
export type GetUsersGrantsByResourceIdResponse = {
  subjects: {
    id: number;
    type: SubjectType;
    grant: Grant;
    name: string;
  }[];
};

export type SubjectItemWithGrant = GetUsersGrantsByResourceIdResponse['subjects'];

export { mockedEditoastApi };
