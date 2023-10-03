import { expect, test } from 'vitest';
import { createStoreWithoutMiddleware } from 'Store';
import {
  userInitialState,
  loginSuccess,
  loginError,
  logoutUser,
  serverError,
  updateAccount,
  UserState,
} from 'reducers/user';

const createStore = (initialStateExtra?: UserState) =>
  createStoreWithoutMiddleware({
    user: initialStateExtra,
  });

describe('userReducer', () => {
  test('should return the initial state', () => {
    const store = createStore(userInitialState);
    const userState = store.getState().user;
    expect(userState).toEqual(userInitialState);
  });

  test('should handle loginSuccess', () => {
    const store = createStore(userInitialState);
    const action = loginSuccess({ accessToken: 'fake_token', username: 'Test userSlice' });
    store.dispatch(action);
    const userState = store.getState().user;
    expect(userState).toEqual({
      isLogged: true,
      toLogin: false,
      loginError: false,
      serverError: false,
      username: 'Test userSlice',
      accessToken: 'fake_token',
      account: {},
    });
  });

  test('should handle loginError', () => {
    const store = createStore(userInitialState);
    const action = loginError(true);
    store.dispatch(action);
    const userState = store.getState().user;
    expect(userState).toEqual({
      isLogged: false,
      toLogin: true,
      loginError: true,
      serverError: false,
      username: '',
      accessToken: undefined,
      account: {},
    });
  });

  test('should handle logoutUser', () => {
    const store = createStore({
      isLogged: true,
      toLogin: false,
      loginError: false,
      serverError: false,
      username: 'Test userSlice',
      accessToken: 'fake_token',
      account: {},
    });
    const action = logoutUser();
    store.dispatch(action);
    const userState = store.getState().user;
    expect(userState).toEqual(userInitialState);
  });

  test('should handle serverError', () => {
    const store = createStore(userInitialState);
    const action = serverError();
    store.dispatch(action);
    const userState = store.getState().user;
    expect(userState).toEqual({
      isLogged: false,
      toLogin: true,
      loginError: false,
      serverError: true,
      username: '',
      accessToken: undefined,
      account: {},
    });
  });

  test('should handle updateAccount', () => {
    const store = createStore(userInitialState);
    const action = updateAccount({ username: 'Test userSlice' });
    store.dispatch(action);
    const userState = store.getState().user;
    expect(userState).toEqual({
      isLogged: false,
      toLogin: true,
      loginError: false,
      serverError: false,
      username: '',
      accessToken: undefined,
      account: { username: 'Test userSlice' },
    });
  });
});
