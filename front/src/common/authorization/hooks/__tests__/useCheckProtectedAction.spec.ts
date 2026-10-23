import { renderHookWithStore } from 'store/__tests__';
import { describe, it, expect, vi } from 'vitest';

import type { Privilege } from 'common/authorization/types';

import { useCheckProtectedAction } from '../useProtectedAction';

const requiredPrivileges: Privilege[] = ['can_read', 'can_write'];

describe('useCheckProtectedAction', () => {
  it('should execute action when all required privileges are present', async () => {
    const action = vi.fn();
    const userPrivileges = new Set<Privilege>(['can_read', 'can_write']);

    const { result: checkProtectedAction, store } = renderHookWithStore(() =>
      useCheckProtectedAction()
    );

    await checkProtectedAction.current(userPrivileges, requiredPrivileges, action);

    expect(action).toHaveBeenCalledOnce();
    expect(store.getState().main.notifications).toHaveLength(0);
  });

  it('should dispatch an unauthorized notification when a privilege is missing', async () => {
    const action = vi.fn();
    const userPrivileges = new Set<Privilege>(['can_read']);

    const { result: checkProtectedAction, store } = renderHookWithStore(() =>
      useCheckProtectedAction()
    );

    await checkProtectedAction.current(userPrivileges, requiredPrivileges, action);

    expect(action).not.toHaveBeenCalled();
    expect(store.getState().main.notifications).toHaveLength(1);
  });

  it('should execute action when no privilege is required', async () => {
    const action = vi.fn();

    const { result: checkProtectedAction, store } = renderHookWithStore(() =>
      useCheckProtectedAction()
    );

    await checkProtectedAction.current(new Set<Privilege>(), [], action);

    expect(action).toHaveBeenCalledOnce();
    expect(store.getState().main.notifications).toHaveLength(0);
  });
});
