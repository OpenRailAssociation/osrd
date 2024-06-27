const useUserPermissionsCheck = (
  _ressource: { id: string; type: string },
  minimalPermission?: string
) => {
  if (!minimalPermission) {
    return true;
  }

  // TODO AUTH:
  // - get user permissions on ressource when it is implemented
  // - check if user has the minimal permission
  return true;
};

export default useUserPermissionsCheck;
