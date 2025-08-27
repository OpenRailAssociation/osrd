import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { Notification } from 'types';

export type MainState = {
  loading: number;
  notifications: Array<Notification>;
  lastInterfaceVersion: string;
};

export const mainInitialState: MainState = {
  // Number of running task
  loading: 0,
  // errors
  notifications: [],
  lastInterfaceVersion: '',
};

export const mainSlice = createSlice({
  name: 'main',
  initialState: mainInitialState,
  reducers: {
    // TODO rename setLoading, setSucess with more meaningful names like pushLoadingNotification, pushSucessNotification, ...
    setLoading(state) {
      state.loading += 1;
    },
    setSuccess(state, action: PayloadAction<{ title: string; text: string }>) {
      state.loading = state.loading > 0 ? state.loading - 1 : 0;
      state.notifications.push({
        type: 'success',
        title: action.payload.title,
        text: action.payload.text,
        date: new Date(),
      });
    },
    setSuccessWithoutMessage(state) {
      state.loading = state.loading > 0 ? state.loading - 1 : 0;
    },
    setWarning(state, action: PayloadAction<{ title: string; text: string }>) {
      state.loading = state.loading > 0 ? state.loading - 1 : 0;
      state.notifications.push({
        type: 'warning',
        title: action.payload.title,
        text: action.payload.text,
        date: new Date(),
      });
    },
    setFailure(state, action: PayloadAction<Error>) {
      state.loading = state.loading > 0 ? state.loading - 1 : 0;
      state.notifications.push({
        type: 'error',
        title: action.payload.name,
        text: action.payload.message,
        date: new Date(),
      });
    },
    addSuccessNotification(state, action: PayloadAction<{ title: string; text: string }>) {
      state.notifications.push({
        type: 'success',
        title: action.payload.title,
        text: action.payload.text,
        date: new Date(),
      });
    },
    addFailureNotification(state, action: PayloadAction<{ name: string; message: string }>) {
      state.notifications.push({
        type: 'error',
        title: action.payload.name,
        text: action.payload.message,
        date: new Date(),
      });
    },
    deleteNotification(state, action: PayloadAction<Notification>) {
      state.notifications = state.notifications.filter(
        (notification: Notification) =>
          !(
            notification.date === action.payload.date &&
            notification.text === action.payload.text &&
            notification.title === action.payload.title &&
            notification.type === action.payload.type
          )
      );
    },
    updateLastInterfaceVersion(state, action: PayloadAction<string>) {
      state.lastInterfaceVersion = action.payload;
    },
  },
});

export const {
  setLoading,
  setSuccess,
  setSuccessWithoutMessage,
  setWarning,
  setFailure,
  addSuccessNotification,
  addFailureNotification,
  deleteNotification,
  updateLastInterfaceVersion,
} = mainSlice.actions;

export default mainSlice.reducer;
