import { useEffect, useMemo, useState } from 'react';

import { mockedEditoastApi, type Grant, type ResourceType } from 'common/api/mock/mockEditoastApi';

export type SubjectItemWithGrant = {
  id: number;
  type: string;
  grant: Grant;
  name: string;
}[];

/**
 * provides the user grants on a list of resources
 * @param payload the resource type and the resource ids
 * @returns the user grants on the resources
 */
// TODO: Improve this hook to handle the case where the payload contains multiple resource types. In such cases, ensure to check if there are IDs for each resource type.
const useResourcesGrants = (payload: Partial<Record<ResourceType, number[]>>) => {
  const hasResources = Object.entries(payload).some(([_, ids]) => ids.length > 0);
  const [fetchUserGrantByResourceId, { data: userResourcesGrants }] =
    mockedEditoastApi.endpoints.postUserResourcesGrants.useMutation();

  const { data: resourceGrants } =
    mockedEditoastApi.endpoints.getGrantsByResourceType.useQuery('infra');

  const { data: subjectsList } = mockedEditoastApi.endpoints.getSubjects.useQuery();

  const userSubjectsList = useMemo(
    () => (subjectsList || []).filter((subject) => subject.type === 'user' && subject.id !== 1), // TODO Get the user id from the store
    [subjectsList]
  );

  const [postSubjectsGrantsByResourceId] =
    mockedEditoastApi.endpoints.postUsersGrantsByResourceId.useMutation();

  const [usersInfraGrantsByInfraId, setUsersInfraGrantsByInfraId] = useState<
    Record<number, SubjectItemWithGrant>
  >({});

  useEffect(() => {
    const getUserGrantByResourceId = async () => {
      try {
        await fetchUserGrantByResourceId(payload);
      } catch (error) {
        console.error(error);
      }
    };

    const getUserSubjectsGrantsByInfraIds = async () => {
      const userSubjectsIds = userSubjectsList.map((subject) => subject.id);
      if (!payload.infra) return;
      try {
        const results = await Promise.all(
          payload.infra.map(async (infraId) => {
            const response = await postSubjectsGrantsByResourceId({
              subjects_id: userSubjectsIds,
              resource_type: 'infra',
              resource_id: infraId,
            }).unwrap();
            return { infraId, grants: response };
          })
        );

        const newGrantsByInfraId = results.reduce<Record<number, SubjectItemWithGrant>>(
          (acc, { infraId, grants: subjectsGrants }) => {
            const subjectGrantsWithDetails = subjectsGrants.map((subjectGrant) => {
              const subjectName = userSubjectsList.find(
                (subject) => subjectGrant.id === subject.id
              )!.name;

              return { ...subjectGrant, name: subjectName };
            });
            acc[infraId] = subjectGrantsWithDetails;
            return acc;
          },
          {}
        );

        setUsersInfraGrantsByInfraId(newGrantsByInfraId);
      } catch (error) {
        console.error(error);
      }
    };

    if (hasResources) {
      getUserGrantByResourceId();
      getUserSubjectsGrantsByInfraIds();
    }
  }, [payload, hasResources]);

  return {
    resourceGrants,
    userResourcesGrants,
    usersInfraGrantsByInfraId,
  };
};

export default useResourcesGrants;
