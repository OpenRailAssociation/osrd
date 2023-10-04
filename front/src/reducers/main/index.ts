import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Notification } from 'types';

export interface MainState {
  loading: number;
  notifications: Array<Notification>;
  lastInterfaceVersion: string;
}

export const mainInitialState: MainState = {
  // Number of running task
  loading: 0,
  // errors
  notifications: [],
  lastInterfaceVersion: '',
};

const mainSlice = createSlice({
  name: 'main',
  initialState: mainInitialState,
  reducers: {
    setLoading(state) {
      state.loading += 1;
    },
    setSuccess(state, action: PayloadAction<Notification | undefined>) {
      state.loading = state.loading > 0 ? state.loading - 1 : 0;
      if (action.payload) {
        state.notifications.push({
          type: action?.payload.type || 'success',
          title: action?.payload.title,
          text: action?.payload.text,
          date: action?.payload.date || new Date(),
        });
      }
    },
    setWarning(state, action: PayloadAction<Notification | undefined>) {
      state.loading = state.loading > 0 ? state.loading - 1 : 0;
      if (action.payload) {
        state.notifications.push({
          type: action.payload.type || 'warning',
          title: action.payload.title,
          text: action.payload.text,
          date: action.payload.date || new Date(),
        });
      }
    },
    setFailure(state, action: PayloadAction<Error | undefined>) {
      state.loading = state.loading > 0 ? state.loading - 1 : 0;
      if (action.payload) {
        state.notifications.push({
          type: 'error',
          title: action.payload.name,
          text: action.payload.message,
          date: new Date(),
        });
      }
    },
    addNotification(state, action: PayloadAction<Notification>) {
      state.notifications.push({ date: new Date(), ...action.payload });
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
  setWarning,
  setFailure,
  addNotification,
  deleteNotification,
  updateLastInterfaceVersion,
} = mainSlice.actions;

export default mainSlice.reducer;
