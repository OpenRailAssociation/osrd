import React, {
  useCallback,
  useEffect,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from 'react';

import { ChevronDown, ChevronUp } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';

type CollapsableProps = Omit<HTMLAttributes<unknown>, 'children' | 'collapsed'> & {
  children: [React.JSX.Element, React.JSX.Element];
  collapsed?: boolean;
  iconPosition?: 'left' | 'right';
  iconClose?: ReactNode;
  iconOpen?: ReactNode;
};

const Collapsable = (props: CollapsableProps) => {
  const {
    children,
    collapsed = false,
    className,
    iconPosition = 'right',
    iconClose = <ChevronUp />,
    iconOpen = <ChevronDown />,
    ...divProps
  } = props;
  const { t } = useTranslation();
  const [isCollapsed, setIsCollapsed] = useState(collapsed);

  const toggle = useCallback(() => {
    setIsCollapsed((prev) => !prev);
  }, []);

  useEffect(() => {
    setIsCollapsed(collapsed);
  }, [collapsed]);

  const iconRender = isCollapsed ? iconOpen : iconClose;

  return (
    <div className={cx(className)} {...divProps}>
      <div className={cx('collapse-header d-flex align-items-start', isCollapsed && 'collapsed')}>
        <button
          type="button"
          className="flex-grow-1 d-flex  text-left"
          title={isCollapsed ? t('common.expand') : t('common.collapse')}
          onClick={toggle}
        >
          {iconPosition === 'left' && iconRender}
          <div className="flex-grow-1">{children[0]}</div>
          {iconPosition === 'right' && iconRender}
        </button>
      </div>
      {isCollapsed && <div className="collapse-body">{children[1]}</div>}
    </div>
  );
};

export default Collapsable;
