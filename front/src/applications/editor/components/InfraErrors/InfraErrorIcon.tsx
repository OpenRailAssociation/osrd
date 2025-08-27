import cx from 'classnames';
import type { IconBaseProps } from 'react-icons';
import { BsFillExclamationCircleFill, BsFillExclamationTriangleFill } from 'react-icons/bs';

import type { InfraError } from 'common/api/osrdEditoastApi';

type InfraErrorIconProps = IconBaseProps & {
  error: InfraError;
};

/**
 * A component that display an infra error Icon.
 */
const InfraErrorIcon = ({ error, ...props }: InfraErrorIconProps) =>
  error.is_warning ? (
    <BsFillExclamationTriangleFill {...props} className={cx('text-warning', props.className)} />
  ) : (
    <BsFillExclamationCircleFill {...props} className={cx('text-danger', props.className)} />
  );

export default InfraErrorIcon;
