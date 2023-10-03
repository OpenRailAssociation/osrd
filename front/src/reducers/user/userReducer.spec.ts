import { expect, it } from 'vitest';
import { createStoreWithoutMiddleware } from 'Store';
import {
  userInitialState,
  loginSuccess,
  loginError,
  logoutSuccess,
  UserState,
  updateUserPreferences,
} from 'reducers/user';

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
      isLogged: true,
      loginError: undefined,
      username: 'Test userSlice',
      userPreferences: { safeWord: '' },
      account: {},
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
      isLogged: false,
      loginError: error,
      username: '',
      userPreferences: { safeWord: '' },
      account: {},
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

  it('should handle updateUserPreferences', () => {
    const store = createStore(userInitialState);
    const action = updateUserPreferences({ safeWord: 'Test userSlice' });
    store.dispatch(action);
    const userState = store.getState().user;
    expect(userState).toEqual({
      isLogged: false,
      loginError: undefined,
      username: '',
      userPreferences: { safeWord: 'Test userSlice' },
      account: {},
    });
  });
});
