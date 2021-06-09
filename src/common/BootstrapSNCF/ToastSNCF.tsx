import React, { FC, PropsWithChildren, useState } from 'react';
import { Notification } from '../../types';
/**
 * Display the date to the "from ago" format.
 * For example :
 *   - il y a 10 secondes
 *  - il y a 3 mintues
 */
function dateToFromAgo(date: Date): string {
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  const prefix = seconds < 0 ? 'dans' : 'il y a';
  const asbSecond = Math.abs(seconds);

  const times = [
    asbSecond / 60 / 60 / 24 / 365, // years
    asbSecond / 60 / 60 / 24 / 30, // months
    asbSecond / 60 / 60 / 24 / 7, // weeks
    asbSecond / 60 / 60 / 24, // days
    asbSecond / 60 / 60, // hours
    asbSecond / 60, // minutes
    asbSecond, // seconds
  ];

  return (
    ['année', 'moi', 'semaine', 'jour', 'heure', 'minute', 'seconde']
      .map((name, index) => {
        const time = Math.floor(times[index]);
        if (time > 0) return `${prefix} ${time} ${name}${time > 1 ? 's' : ''}`;
        return null;
      })
      .reduce((acc, curr) => (acc === null && curr !== null ? curr : null), null) || 'maintenant'
  );
}

// Matching icon per type
const typeToIcon = {
  info: 'icons-circle-information',
  warning: 'icons-warning',
  success: 'icons-checked',
  error: 'icons-circle-disruption',
};

/**
 * Toast for notification object.
 */
const ToastSNCF: FC<Notification> = ({ title, date, type = 'info', text }) => {
  const [open, setOpen] = useState<boolean>(true);

  return (
    <div className={`toast fade ${open ? 'show' : 'hide'} ${type}`}>
      <div className="toast-header">
        <i className={`icons-size-1x25 ${typeToIcon[type]}`} />
        &nbsp;
        <strong className="mr-auto">{title || type}</strong>
        {date && <small>{dateToFromAgo(date)}</small>}
        <button className="ml-2 mb-1 close" onClick={() => setOpen(false)}>
          <span>&times;</span>
        </button>
      </div>
      <div className="toast-body">{text}</div>
    </div>
  );
};

export default ToastSNCF;
