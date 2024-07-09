import React, { useState } from 'react';

import cx from 'classnames';

type TabComponentProps = {
  label: string;
  content: React.ReactNode;
};

export type TabProps = {
  id: string;
  label: string;
  title?: React.ReactNode;
  withWarning?: boolean;
  content: React.ReactNode;
};

type TabsProps = {
  tabs: TabProps[];
  pills?: boolean;
  fullWidth?: boolean;
  fullHeight?: boolean;
};

const Tab = ({ label, content }: TabComponentProps) => (
  <div className="tab-pane active" aria-labelledby={label}>
    {content}
  </div>
);

const Tabs = ({ tabs, pills = false, fullWidth = false, fullHeight = false }: TabsProps) => {
  const [activeTabIndex, setActiveTabIndex] = useState(0);

  const handleTabClick = (index: number) => {
    setActiveTabIndex(index);
  };

  return (
    <div className={cx('tabs-container', { 'full-width': fullWidth, 'full-height': fullHeight })}>
      <div className={cx('tabs', pills && 'pills')}>
        {tabs.map((tab, index) => (
          <div
            data-testid={`tab-${tab.id}`}
            className={cx(
              'tab',
              index === activeTabIndex && 'active',
              tab.withWarning && 'warning'
            )}
            key={`tab-${tab.label}-${index}}`}
            role="button"
            tabIndex={0}
            onClick={() => handleTabClick(index)}
          >
            {tab.title || tab.label}
          </div>
        ))}
      </div>
      <div className="tab-content">
        <Tab {...tabs[activeTabIndex]} />
      </div>
    </div>
  );
};

export default Tabs;
