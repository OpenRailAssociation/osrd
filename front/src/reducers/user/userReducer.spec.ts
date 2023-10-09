import { expect, it } from 'vitest';
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
  it('should return the initial state', () => {
    const store = createStore(userInitialState);
    const userState = store.getState().user;
    expect(userState).toEqual(userInitialState);
  });

  it('should handle loginSuccess', () => {
    const store = createStore(userInitialState);
    store.dispatch(loginSuccess({ accessToken: 'fake_token', username: 'Test userSlice' }));
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

  it('should handle loginError', () => {
    const store = createStore(userInitialState);
    store.dispatch(loginError(true));
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

  it('should handle logoutUser', () => {
    const store = createStore({
      isLogged: true,
      toLogin: false,
      loginError: false,
      serverError: false,
      username: 'Test userSlice',
      accessToken: 'fake_token',
      account: {},
    });
    store.dispatch(logoutUser());
    const userState = store.getState().user;
    expect(userState).toEqual(userInitialState);
  });

  it('should handle serverError', () => {
    const store = createStore(userInitialState);
    store.dispatch(serverError());
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

  it('should handle updateAccount', () => {
    const store = createStore(userInitialState);
    store.dispatch(updateAccount({ username: 'Test userSlice' }));
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
