import { renderHookWithStore } from 'store/__tests__';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { ResourceType } from 'common/authorization/types';
import { useAppSelector } from 'store';

import useAuthz from '../useAuthz';
import useProtectedAction, { type UseProtectedActionParams } from '../useProtectedAction';

vi.mock('../useAuthz');

const { mockCheckUserPrivileges } = vi.hoisted(() => ({
  mockCheckUserPrivileges: vi.fn(),
}));

const mockUseAuthz = vi.mocked(useAuthz, { partial: true });

const createTestParams = (
  resourceType: ResourceType
): { [key: string]: UseProtectedActionParams } => ({
  withRequiredPrivileges: {
    resourceType,
    resourceId: 1,
    privileges: ['can_read', 'can_write'],
  },
  withoutRequiredPrivileges: {
    resourceType,
    resourceId: 1,
    privileges: ['can_read'],
  },
  noPrivilegesRequired: {
    resourceType,
    resourceId: 1,
    privileges: [],
  },
  undefinedResourceId: {
    resourceType,
    privileges: [],
  },
});

const renderHookWithNotifications = ({
  resourceType,
  resourceId,
  privileges,
}: UseProtectedActionParams) =>
  renderHookWithStore(() => {
    const protectedAction = useProtectedAction({ resourceType, resourceId, privileges });
    const notifications = useAppSelector((state) => state.main.notifications);
    return { protectedAction, notifications };
  });

describe('useProtectedAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuthz.mockReturnValue({
      checkUserPrivileges: mockCheckUserPrivileges,
    });
  });

  // This type only contains 2 resource types, but if more are added in the future, this test will automatically cover them as well
  const resourceTypes: ResourceType[] = ['infra', 'rolling_stock'];
  describe.each(resourceTypes)(`with %s resource type`, (resourceType) => {
    const testParams = createTestParams(resourceType);

    it('should execute action when user has the required privileges', async () => {
      mockCheckUserPrivileges.mockResolvedValue(true);
      const action = vi.fn();

      const { result } = renderHookWithNotifications(testParams.withRequiredPrivileges);
      await result.current.protectedAction(action);

      expect(mockCheckUserPrivileges).toHaveBeenCalledWith(resourceType, 1, [
        'can_read',
        'can_write',
      ]);
      expect(action).toHaveBeenCalledOnce();
      expect(result.current.notifications).toHaveLength(0);
    });

    it('should dispatch an unauthorized notification when user lacks required privileges', async () => {
      mockCheckUserPrivileges.mockResolvedValue(false);
      const action = vi.fn();

      const { result } = renderHookWithNotifications(testParams.withoutRequiredPrivileges);
      await result.current.protectedAction(action);

      expect(mockCheckUserPrivileges).toHaveBeenCalledWith(resourceType, 1, ['can_read']);
      expect(action).not.toHaveBeenCalled();
      expect(result.current.notifications).toHaveLength(1);
    });

    it('should execute action when no privilege is required', async () => {
      mockCheckUserPrivileges.mockResolvedValue(true);
      const action = vi.fn();

      const { result } = renderHookWithNotifications(testParams.noPrivilegesRequired);
      await result.current.protectedAction(action);

      expect(mockCheckUserPrivileges).toHaveBeenCalledWith(resourceType, 1, []);
      expect(action).toHaveBeenCalledOnce();
      expect(result.current.notifications).toHaveLength(0);
    });

    it('should not execute action when resourceId is undefined', async () => {
      mockCheckUserPrivileges.mockResolvedValue(true);
      const action = vi.fn();

      const { result } = renderHookWithNotifications(testParams.undefinedResourceId);
      await result.current.protectedAction(action);

      expect(mockCheckUserPrivileges).not.toHaveBeenCalled();
      expect(action).not.toHaveBeenCalled();
      expect(result.current.notifications).toHaveLength(0);
    });
  });
});
