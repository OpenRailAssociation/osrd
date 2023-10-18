import React, { FC } from 'react';
import { BsFillExclamationCircleFill, BsFillExclamationTriangleFill } from 'react-icons/bs';
import cx from 'classnames';
import { IconBaseProps } from 'react-icons';

import { InfraError } from './types';

/**
 * A component that display an infra error Icon.
 */
interface InfraErrorIconProps extends IconBaseProps {
  error: InfraError['information'];
}
const InfraErrorIcon: FC<InfraErrorIconProps> = ({ error, ...props }) =>
  error.is_warning ? (
    <BsFillExclamationTriangleFill {...props} className={cx('text-warning', props.className)} />
  ) : (
    <BsFillExclamationCircleFill {...props} className={cx('text-danger', props.className)} />
  );

export default InfraErrorIcon;
