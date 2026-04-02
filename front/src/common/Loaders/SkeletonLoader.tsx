import { useState } from 'react';

import cx from 'classnames';

import './SkeletonLoader.scss';

type SkeletonLoaderProps = {
  className?: string;
  'data-testid'?: string;
};

const SkeletonLoader = ({ className, 'data-testid': testId }: SkeletonLoaderProps) => {
  const [animationDelay] = useState(() => Math.random());
  return (
    <span
      className={cx('skeleton-loader', className)}
      data-testid={testId}
      style={{ animationDelay: `${animationDelay}s` }}
    />
  );
};

export default SkeletonLoader;
