import { describe, it, expect } from 'vitest';

import {
  mainInitialState,
  setLoading,
  setSuccess,
  setWarning,
  setFailure,
  deleteNotification,
  updateLastInterfaceVersion,
  type MainState,
  setSuccessWithoutMessage,
  addFailureNotification,
  addSuccessNotification,
} from 'reducers/main';
import { createStoreWithoutMiddleware } from 'store';

const createStore = (initialStateExtra?: MainState) =>
  createStoreWithoutMiddleware({
    main: initialStateExtra,
  });
const mainStateWithSinglePendingRequest: MainState = { ...mainInitialState, loading: 1 };

describe('mainReducer', () => {
  it('should return the initial state', () => {
    const store = createStore(mainInitialState);
    const mainState = store.getState().main;
    expect(mainState).toEqual(mainInitialState);
  });

  it('should handle setLoading', () => {
    const store = createStore(mainInitialState);
    const action = setLoading();
    store.dispatch(action);
    const mainState = store.getState().main;
    expect(mainState).toEqual({
      loading: 1,
      notifications: [],
      lastInterfaceVersion: '',
    });
  });

  it('should handle setSuccess', () => {
    const store = createStore(mainStateWithSinglePendingRequest);
    const action = setSuccess({
      title: 'Test title',
      text: 'Test text',
    });
    store.dispatch(action);
    const mainState = store.getState().main;
    expect(mainState).toEqual({
      loading: 0,
      notifications: [
        {
          type: 'success',
          title: 'Test title',
          text: 'Test text',
          date: expect.any(Date),
        },
      ],
      lastInterfaceVersion: '',
    });
  });

  it('should handle setSuccessWithoutMessage', () => {
    const store = createStore(mainStateWithSinglePendingRequest);
    const action = setSuccessWithoutMessage();
    store.dispatch(action);
    const mainState = store.getState().main;
    expect(mainState).toEqual({
      loading: 0,
      notifications: [],
      lastInterfaceVersion: '',
    });
  });

  it('should handle setWarning', () => {
    const store = createStore(mainStateWithSinglePendingRequest);
    const action = setWarning({
      title: 'Test title',
      text: 'Test text',
    });
    store.dispatch(action);
    const mainState = store.getState().main;
    expect(mainState).toEqual({
      loading: 0,
      notifications: [
        {
          type: 'warning',
          title: 'Test title',
          text: 'Test text',
          date: expect.any(Date),
        },
      ],
      lastInterfaceVersion: '',
    });
  });

  it('should handle setFailure', () => {
    const store = createStore(mainStateWithSinglePendingRequest);
    const action = setFailure(new Error('Test error'));
    store.dispatch(action);
    const mainState = store.getState().main;
    expect(mainState).toEqual({
      loading: 0,
      notifications: [
        {
          type: 'error',
          title: 'Error',
          text: 'Test error',
          date: expect.any(Date),
        },
      ],
      lastInterfaceVersion: '',
    });
  });

  it('should handle addSuccessNotification', () => {
    const store = createStore(mainStateWithSinglePendingRequest);
    const action = addSuccessNotification({
      title: 'Test title',
      text: 'Test text',
    });
    store.dispatch(action);
    const mainState = store.getState().main;
    expect(mainState).toEqual({
      loading: 1,
      notifications: [
        {
          type: 'success',
          title: 'Test title',
          text: 'Test text',
          date: expect.any(Date),
        },
      ],
      lastInterfaceVersion: '',
    });
  });

  it('should handle addFailureNotification', () => {
    const store = createStore(mainStateWithSinglePendingRequest);
    const action = addFailureNotification(new Error('Test error'));
    store.dispatch(action);
    const mainState = store.getState().main;
    expect(mainState).toEqual({
      loading: 1,
      notifications: [
        {
          type: 'error',
          title: 'Error',
          text: 'Test error',
          date: expect.any(Date),
        },
      ],
      lastInterfaceVersion: '',
    });
  });

  it('should handle deleteNotification', () => {
    const notificationDate = new Date();
    const store = createStore({
      loading: 0,
      notifications: [
        {
          type: 'warning',
          title: 'Test title',
          text: 'Test text',
          date: notificationDate,
        },
      ],
      lastInterfaceVersion: '',
    });
    const action = deleteNotification({
      type: 'warning',
      title: 'Test title',
      text: 'Test text',
      date: notificationDate,
    });
    store.dispatch(action);
    const mainState = store.getState().main;
    expect(mainState).toEqual({
      loading: 0,
      notifications: [],
      lastInterfaceVersion: '',
    });
  });

  it('should handle updateLastInterfaceVersion', () => {
    const store = createStore(mainInitialState);
    const action = updateLastInterfaceVersion('1.0.0');
    store.dispatch(action);
    const mainState = store.getState().main;
    expect(mainState).toEqual({
      loading: 0,
      notifications: [],
      lastInterfaceVersion: '1.0.0',
    });
  });
});
