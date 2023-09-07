import React, { FC, HTMLAttributes } from 'react';
import { useSelector } from 'react-redux';
import cx from 'classnames';

import { MainState } from 'reducers/main';
import './Loader.scss';

export const Spinner: FC<HTMLAttributes<HTMLDivElement>> = (props) => (
  <div {...props}>
    <div className="spinner-border" role="status">
      <span className="sr-only">Loading...</span>
    </div>
  </div>
);

const LoaderSNCF: FC<{
  msg?: string;
  position?: 'center' | 'top-left' | 'top-right' | 'bottom-right' | 'bottom-left';
}> = ({ msg = '', position = 'center' }) => (
  <div className={`loader ${position}`}>
    <Spinner />
    <div className="text-center mt-2">{msg}</div>
  </div>
);

export const LoaderFill: FC<HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => (
  <Spinner {...props} className={cx(`loader-fill inset-0`, className)} />
);

export const LoaderState: FC<unknown> = () => {
  const loading = useSelector((state: MainState) => state.loading);
  if (loading && loading > 0) return <LoaderSNCF position="top-right" />;
  return null;
};

export default LoaderSNCF;
