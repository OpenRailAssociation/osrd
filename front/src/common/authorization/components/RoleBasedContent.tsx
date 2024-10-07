import React from 'react';

import type { BuiltinRole } from 'common/api/osrdEditoastApi';

import useUserRoleCheck from '../hooks/useUserRoleCheck';

export type RoleBasedContentProps = {
  requiredRoles: BuiltinRole[];
  disableIfUnauthorized?: boolean;
  children: React.ReactNode;
};

const RoleBasedContent = ({
  requiredRoles,
  children,
  disableIfUnauthorized = false,
}: RoleBasedContentProps) => {
  const isRoleAllowed = useUserRoleCheck(requiredRoles);

  if (isRoleAllowed) {
    return children;
  }

  if (disableIfUnauthorized) {
    return React.Children.map(children, (child) => {
      if (React.isValidElement(child)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const props: any = {
          'aria-disabled': true,
          style: { pointerEvents: 'none', opacity: 0.5 },
        };

        if (child.type === 'button' || child.type === 'input') {
          props.disabled = true;
        }

        return React.cloneElement(child, props);
      }
      return child;
    });
  }

  return null;
};

export default RoleBasedContent;
