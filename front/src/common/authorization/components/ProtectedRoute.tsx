import { Navigate } from 'react-router-dom';

import type { Role } from 'common/api/osrdEditoastApi';

import useUserRoleCheck from '../hooks/useUserRoleCheck';

type ProtectedRouteProps = {
  allowedRoles: Role[];
  children: React.ReactNode;
};

const ProtectedRoute = ({ allowedRoles, children }: ProtectedRouteProps) => {
  const isRoleAllowed = useUserRoleCheck(allowedRoles);

  if (!isRoleAllowed) {
    return <Navigate to="/403" />;
  }

  return children;
};

export default ProtectedRoute;
