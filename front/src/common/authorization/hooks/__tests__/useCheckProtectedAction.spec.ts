import { renderHookWithStore } from 'store/__tests__';
import { describe, it, expect, vi } from 'vitest';

import type { Privilege } from 'common/authorization/types';
import { useAppSelector } from 'store';

import { useCheckProtectedAction } from '../useProtectedAction';

const renderHookWithNotifications = () =>
  renderHookWithStore(() => {
    const checkProtectedAction = useCheckProtectedAction();
    const notifications = useAppSelector((state) => state.main.notifications);
    return { checkProtectedAction, notifications };
  });

const requiredPrivileges: Privilege[] = ['can_read', 'can_write'];

describe('useCheckProtectedAction', () => {
  it('should execute action when all required privileges are present', async () => {
    const action = vi.fn();
    const userPrivileges = new Set<Privilege>(['can_read', 'can_write']);

    const { result } = renderHookWithNotifications();

    await result.current.checkProtectedAction(userPrivileges, requiredPrivileges, action);

    expect(action).toHaveBeenCalledOnce();
    expect(result.current.notifications).toHaveLength(0);
  });

  it('should dispatch an unauthorized notification when a privilege is missing', async () => {
    const action = vi.fn();
    const userPrivileges = new Set<Privilege>(['can_read']);

    const { result } = renderHookWithNotifications();

    await result.current.checkProtectedAction(userPrivileges, requiredPrivileges, action);

    expect(action).not.toHaveBeenCalled();
    expect(result.current.notifications).toHaveLength(1);
  });

  it('should execute action when no privilege is required', async () => {
    const action = vi.fn();

    const { result } = renderHookWithNotifications();

    await result.current.checkProtectedAction(new Set<Privilege>(), [], action);

    expect(action).toHaveBeenCalledOnce();
    expect(result.current.notifications).toHaveLength(0);
  });
});
