import React, { type FC, type HTMLAttributes, useEffect, useRef, useState } from 'react';

import cx from 'classnames';
import { useSelector } from 'react-redux';

import { getIsLoading } from 'reducers/main/mainSelector';
import './Loader.scss';

type SpinnerProps = HTMLAttributes<HTMLDivElement> & { displayDelay?: number };

export const Spinner: FC<SpinnerProps> = ({ displayDelay, ...props }) => {
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

export const LoaderFill: FC<SpinnerProps> = ({ className, ...props }) => (
  <Spinner {...props} className={cx(`loader-fill inset-0`, className)} />
);

type LoaderProps = {
  msg?: string;
  position?: 'center' | 'top-left' | 'top-right' | 'bottom-right' | 'bottom-left';
  childClass?: string;
  className?: string;
};

export const Loader: FC<LoaderProps> = ({
  msg = '',
  position = 'center',
  childClass = '',
  className = '',
}) => (
  <div className={`loader ${position} ${className}`}>
    <Spinner />
    <div className={childClass}>{msg}</div>
  </div>
);

export const LoaderState: FC<unknown> = () => {
  const isLoading = useSelector(getIsLoading);
  return isLoading ? <Loader position="top-right" /> : null;
};
