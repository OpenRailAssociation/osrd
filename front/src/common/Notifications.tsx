import React, { FC, useCallback, useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import ToastSNCF from './BootstrapSNCF/ToastSNCF';
import { MainState, deleteNotification } from '../reducers/main';
import { Notification } from '../types';
import './Notifications.scss';

const TIMEOUT_MS = 5000;

// TODO: review lifecycle of start/clear
const NotificationWrapper: FC<Notification> = (notif) => {
  const [timeoutId, setTimeoutId] = useState<number | null>(null);
  const dispatch = useDispatch();

  const startTimer = useCallback(() => {
    const id = window.setTimeout(() => {
      dispatch(deleteNotification(notif));
    }, TIMEOUT_MS);
    setTimeoutId(id);
  }, [dispatch, notif]);

  const clearTimer = useCallback(() => {
    if (timeoutId) window.clearTimeout(timeoutId);
  }, [timeoutId]);

  /**
   * When component mount,
   */
  useEffect(() => {
    startTimer();
    return () => {
      clearTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div onMouseEnter={clearTimer} onMouseLeave={startTimer}>
      <ToastSNCF {...notif} />
    </div>
  );
};

interface Props {
  notifications: Array<Notification>;
}
const Notifications: FC<Props> = (props) => {
  const { notifications } = props;

  return (
    <div className="notifications">
      {notifications.map((notif: Notification, index) => (
        <NotificationWrapper key={index} {...notif} />
      ))}
    </div>
  );
};

/**
 * Same component plugged on the state.
 */
export const NotificationsState = () => {
  const notifications = useSelector((state: { main: MainState }) => state.main.notifications);
  return <Notifications notifications={notifications} />;
};

export default NotificationsState;
