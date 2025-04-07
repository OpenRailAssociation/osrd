import { mockedEditoastApi, type ResourceType } from 'common/api/mock/mockEditoastApi';

const useOtherUsersGrants = ({
  resourceId,
  resourceType,
}: {
  resourceId: number;
  resourceType: ResourceType;
}) => {
  const { userSubjectsList } = mockedEditoastApi.endpoints.getUsersGrantsByResourceId.useQuery(
    {
      resource_type: resourceType,
      resource_id: resourceId,
    },
    {
      skip: !resourceId,
      selectFromResult: (response) => ({
        ...response,
        userSubjectsList: response.data?.filter((user) => user.type !== 'group'),
      }),
    }
  );

  return {
    userSubjectsList,
  };
};

export default useOtherUsersGrants;
