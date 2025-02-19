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
    getGrantsByResourceType: build.query<GetGrantsByResourceTypeResponse, void>({
      // url: /authz/grants/${queryArg.resource_type} (to keep it simple, we don't provide a resource_type in the mock)
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
  }),
});

// ------------------ TYPES --------------------

type ResourceType = 'infra' | 'timetable';

type Grant = 'NONE' | 'READER' | 'WRITER' | 'OWNER';

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

type GetSubjectsResponse = { type: string; id: number; name: string }[];

type GetGrantsByResourceTypeResponse = {
  [grant: string]: string[];
};

type GetUserResponse = { id: number; name: string; roles: string[] };

type PostUserResourcesGrantsArg = { [resource_type: string]: number[] };
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
type PostUsersGrantsByResourceIdResponse = {
  id: number;
  type: string;
  grant: Grant;
}[];

export { mockedEditoastApi };
