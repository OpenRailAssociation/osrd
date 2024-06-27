import React from 'react';

import { Navigate } from 'react-router-dom';

import useUserRoleCheck from '../hooks/useUserRoleCheck';

type ProtectedRouteProps = {
  allowedRoles: string[];
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
