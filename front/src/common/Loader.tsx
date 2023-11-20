import React, { FC, HTMLAttributes, useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import cx from 'classnames';

import './Loader.scss';
import { getIsLoading } from 'reducers/main/mainSelector';

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

  return display ? (
    <div {...props}>
      <div className="spinner-border" role="status">
        <span className="sr-only">Loading...</span>
      </div>
    </div>
  ) : null;
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

const LoaderSNCF: FC<LoaderProps> = ({
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
  return isLoading ? <LoaderSNCF position="top-right" /> : null;
};

export default LoaderSNCF;
