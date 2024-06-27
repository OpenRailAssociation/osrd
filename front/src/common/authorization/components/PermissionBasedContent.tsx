import useUserPermissionsCheck from '../hooks/useUserPermissionsCheck';

type PermissionBasedContentProps = {
  minimalPermission: string;
  ressourceId: string;
  ressourceType: string;
  children: React.ReactNode;
};

const PermissionBasedContent = ({
  minimalPermission,
  ressourceId,
  ressourceType,
  children,
}: PermissionBasedContentProps) => {
  const hasMinimalPermission = useUserPermissionsCheck(
    { id: ressourceId, type: ressourceType },
    minimalPermission
  );

  if (hasMinimalPermission) {
    return children;
  }

  return null;
};

export default PermissionBasedContent;
