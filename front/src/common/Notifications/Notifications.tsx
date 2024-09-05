import { useCallback, useState, useEffect } from 'react';

import { useSelector } from 'react-redux';

import ToastSNCF from 'common/BootstrapSNCF/ToastSNCF';
import { type MainState, deleteNotification } from 'reducers/main';
import { useAppDispatch } from 'store';
import type { Notification } from 'types';

const TIMEOUT_MS = 5000;

const NotificationWrapper = (notif: Notification) => {
  const [timeoutId, setTimeoutId] = useState<number | null>(null);
  const dispatch = useAppDispatch();

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
   * When component mount, we start the timer
   * and clean-up it on unmount
   */
  useEffect(() => {
    startTimer();
    return () => {
      clearTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div onMouseEnter={() => clearTimer()} onMouseLeave={() => startTimer()}>
      <ToastSNCF {...notif} />
    </div>
  );
};

interface Props {
  notifications: Array<Notification>;
}
const Notifications = (props: Props) => {
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
