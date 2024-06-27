const useUserRoleCheck = (allowedRoles: string[]) => {
  if (allowedRoles.length === 0) {
    return true;
  }

  // TODO AUTH:
  // - get user role when it is implemented
  // - return if the use has the right role
  return false;
};

export default useUserRoleCheck;
