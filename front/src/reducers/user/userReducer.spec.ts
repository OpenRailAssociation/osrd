import { describe, expect, it } from 'vitest';

import {
  userInitialState,
  loginSuccess,
  loginError,
  logoutSuccess,
  type UserState,
  updateUserPreferences,
  updateAuthzUser,
  setImpersonatedUser,
} from 'reducers/user';
import { createStoreWithoutMiddleware } from 'store';

const createStore = (initialStateExtra?: UserState) =>
  createStoreWithoutMiddleware({
    user: initialStateExtra,
  });

describe('userReducer', () => {
  it('should return the initial state', () => {
    const store = createStore(userInitialState);
    const userState = store.getState().user;
    expect(userState).toEqual(userInitialState);
  });

  it('should handle loginSuccess', () => {
    const store = createStore(userInitialState);
    store.dispatch(loginSuccess({ username: 'Test userSlice' }));
    const userState = store.getState().user;
    expect(userState).toEqual({
      ...userInitialState,
      isLogged: true,
      username: 'Test userSlice',
    });
  });

  it('should handle loginError', () => {
    const store = createStore(userInitialState);
    const error = {
      data: {
        type: 'error_type',
        message: 'message',
        context: {},
      },
      status: 502,
    };
    store.dispatch(loginError(error));
    const userState = store.getState().user;
    expect(userState).toEqual({
      ...userInitialState,
      loginError: error,
    });
  });

  it('should handle logoutUser', () => {
    const store = createStore({
      ...userInitialState,
      isLogged: true,
      username: 'Test userSlice',
      userPreferences: { safeWord: '' },
    });
    store.dispatch(logoutSuccess());
    const userState = store.getState().user;
    expect(userState).toEqual(userInitialState);
  });

  it('should handle updateAuthzUser', () => {
    const store = createStore(userInitialState);
    store.dispatch(updateAuthzUser({ userRoles: ['Stdcm'], userId: 44 }));
    const userState = store.getState().user;
    expect(userState).toEqual({
      ...userInitialState,
      userRoles: ['Stdcm'],
      userId: 44,
    });
  });

  it('should handle setImpersonatedUser', () => {
    const store = createStore(userInitialState);
    const impersonatedUser = { id: 1, identity_id: 'user1', name: 'ImpersonatedUser' };
    store.dispatch(setImpersonatedUser(impersonatedUser));
    const userState = store.getState().user;
    expect(userState).toEqual({
      ...userInitialState,
      impersonatedUser,
    });
  });

  it('should handle updateUserPreferences', () => {
    const store = createStore(userInitialState);
    const action = updateUserPreferences({ safeWord: 'Test userSlice' });
    store.dispatch(action);
    const userState = store.getState().user;
    expect(userState).toEqual({
      ...userInitialState,
      userPreferences: { safeWord: 'Test userSlice' },
    });
  });
});
