import type { BuiltinRole } from 'common/api/osrdEditoastApi';

import useUserRoleCheck from '../hooks/useUserRoleCheck';

export type RoleBasedContentProps = {
  requiredRoles: BuiltinRole[];
  children: React.ReactNode;
};

const RoleBasedContent = ({ requiredRoles, children }: RoleBasedContentProps) => {
  const isRoleAllowed = useUserRoleCheck(requiredRoles);

  if (isRoleAllowed) {
    return children;
  }

  return null;
};

export default RoleBasedContent;
