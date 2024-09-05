import { useState } from 'react';

import type { Notification } from 'types';
/**
 * Display the date to the "from ago" format.
 * For example :
 *   - il y a 10 secondes
 *  - il y a 3 mintues
 */
function dateToFromAgo(date: Date): string {
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  const prefix = seconds < 0 ? 'dans' : 'il y a';
  const absSecond = Math.abs(seconds);

  const times = [
    absSecond / 60 / 60 / 24 / 365, // years
    absSecond / 60 / 60 / 24 / 30, // months
    absSecond / 60 / 60 / 24 / 7, // weeks
    absSecond / 60 / 60 / 24, // days
    absSecond / 60 / 60, // hours
    absSecond / 60, // minutes
    absSecond, // seconds
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
const ToastSNCF = ({ title, date, type, text }: Notification) => {
  const [open, setOpen] = useState<boolean>(true);

  return (
    <div className={`toast fade ${open ? 'show' : 'hide'} ${type}`} data-testid="toast-SNCF">
      <div className="toast-header">
        <i className={`icons-size-1x25 ${typeToIcon[type]}`} />
        &nbsp;
        <strong className="mr-auto ml-1" data-testid="toast-SNCF-title">
          {title || type}
        </strong>
        {date && <small>{dateToFromAgo(date)}</small>}
        <button type="button" className="ml-2 close" onClick={() => setOpen(false)}>
          <span>&times;</span>
        </button>
      </div>
      <div className="toast-body">{text}</div>
    </div>
  );
};

export default ToastSNCF;
