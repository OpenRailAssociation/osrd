import { mockedEditoastApi, type Grant, type ResourceType } from 'common/api/mock/mockEditoastApi';

const useSubjectsResourceGrants = ({
  resourceId,
  resourceType,
}: {
  resourceId: number;
  resourceType: ResourceType;
}) => {
  const { usersGrants } = mockedEditoastApi.endpoints.getUsersGrantsByResourceId.useQuery(
    {
      resource_type: resourceType,
      resource_id: resourceId,
    },
    {
      selectFromResult: (response) => ({
        ...response,
        usersGrants: response.data?.subjects.filter((user) => user.type !== 'Group'),
      }),
    }
  );

  const updateUserGrant = (userId: number, grant?: Grant) => {
    const basePayload = {
      resource_type: resourceType,
      resource_id: resourceId,
      subject_id: userId,
    };

    const payload = grant ? { grant: [{ ...basePayload, grant }] } : { revoke: [basePayload] };

    // TODO: Add the RTK call here to post the new user's grant (& check payload structure)
    console.info('updateUserGrant -- ', { payload });
  };

  return {
    /** List of users that have a grant on the resource */
    usersGrants,
    updateUserGrant,
  };
};

export default useSubjectsResourceGrants;
