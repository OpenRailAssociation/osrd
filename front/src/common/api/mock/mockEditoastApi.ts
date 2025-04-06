import { keyBy } from 'lodash';

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
            acc[resourceType as ResourceType] = resourceIds.map(
              (resourceId) =>
                resourcesGranted.find((resource) => resource.id === resourceId) || {
                  id: resourceId,
                  grant: 'NONE',
                }
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
          acc.push({
            type: user.type,
            id: user.id,
            grant:
              user.resourcesGranted[resource_type].find((resource) => resource.id === resource_id)
                ?.grant || 'NONE',
          });
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
          data: response,
        };
      },
    }),
  }),
});

// ------------------ TYPES --------------------

export type ResourceType = 'infra' | 'timetable';

export type Grant = 'NONE' | 'READER' | 'WRITER' | 'OWNER';

export type MockedDB = {
  SUBJECTS: {
    type: 'user' | 'group';
    name: string;
    id: number;
    roles: string[];
    resourcesGranted: {
      [key in ResourceType]: { id: number; grant: Grant }[];
    };
  }[];
  GRANTS: {
    [key in Exclude<Grant, 'NONE'>]: string[];
  };
};

export type GetSubjectsResponse = { type: string; id: number; name: string }[];

type GetGrantsByResourceTypeArg = ResourceType;

type GetGrantsByResourceTypeResponse = {
  [grant: string]: string[];
};

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
  type: string;
  grant: Grant;
}[];

type GetUsersGrantsByResourceIdArg = {
  resource_type: ResourceType;
  resource_id: number;
};
export type GetUsersGrantsByResourceIdResponse = {
  id: number;
  type: string;
  grant: Grant;
  name: string;
}[];

export type SubjectItemWithGrant = GetUsersGrantsByResourceIdResponse;

export { mockedEditoastApi };
