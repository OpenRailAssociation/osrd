import React, { useCallback, useEffect, useState, type FC, type HTMLAttributes } from 'react';

import { ChevronDown, ChevronUp } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { omit } from 'lodash';
import { useTranslation } from 'react-i18next';

interface CollapsableProps extends Omit<HTMLAttributes<unknown>, 'children' | 'collapsed'> {
  children: [JSX.Element, JSX.Element];
  collapsed?: boolean;
}
const Collapsable: FC<CollapsableProps> = (props) => {
  const { children, collapsed = false, className } = props;
  const { t } = useTranslation('common/common');
  const [isCollapsed, setIsCollapsed] = useState(collapsed);

  const toggle = useCallback(() => {
    setIsCollapsed((prev) => !prev);
  }, []);

  useEffect(() => {
    setIsCollapsed(collapsed);
  }, [collapsed]);

  return (
    <div className={cx(className, 'p-1')} {...omit(props, ['children', 'collapsed', 'className'])}>
      <div className="collapse-header d-flex align-items-start">
        <div className="flex-grow-1">{children[0]}</div>
        <button
          type="button"
          className="flex-grow-0 px-1 pb-1 mx-1"
          title={isCollapsed ? t('actions.expand') : t('actions.collapse')}
          onClick={toggle}
        >
          {isCollapsed ? <ChevronUp /> : <ChevronDown />}
        </button>
      </div>
      {!isCollapsed && <div className="collapse-header">{children[1]}</div>}
    </div>
  );
};

export default Collapsable;
