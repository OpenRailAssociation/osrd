import React, { type HTMLAttributes, useEffect, useRef, useState } from 'react';

import cx from 'classnames';
import { useSelector } from 'react-redux';

import { getIsLoading } from 'reducers/main/mainSelector';

type SpinnerProps = HTMLAttributes<HTMLDivElement> & { displayDelay?: number };

export const Spinner = ({ displayDelay, ...props }: SpinnerProps) => {
  const [display, setDisplay] = useState(false);
  const timeoutRef = useRef<null | number>(null);

  useEffect(() => {
    if (displayDelay) {
      setDisplay(false);
      timeoutRef.current = window.setTimeout(() => setDisplay(true), displayDelay);
    } else setDisplay(true);

    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, [displayDelay, timeoutRef]);

  if (!display) return null;
  return (
    <div {...props}>
      <div className="spinner-border" role="status">
        <span className="sr-only">Loading...</span>
      </div>
    </div>
  );
};

export const LoaderFill = ({ className, ...props }: SpinnerProps) => (
  <Spinner {...props} className={cx(`loader-fill inset-0`, className)} />
);

type LoaderProps = {
  msg?: string;
  position?: 'center' | 'top-left' | 'top-right' | 'bottom-right' | 'bottom-left';
  childClass?: string;
  className?: string;
};

export const Loader = ({
  msg = '',
  position = 'center',
  childClass = '',
  className = '',
}: LoaderProps) => (
  <div className={`loader ${position} ${className}`}>
    <Spinner />
    <div className={childClass}>{msg}</div>
  </div>
);

export const LoaderState = () => {
  const isLoading = useSelector(getIsLoading);
  return isLoading ? <Loader position="top-right" /> : null;
};
