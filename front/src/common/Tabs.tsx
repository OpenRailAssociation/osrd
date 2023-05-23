import React, { useState } from 'react';
import cx from 'classnames';

type TabProps = {
  label: string;
  title?: React.ReactNode;
  content: React.ReactNode;
};

type TabsProps = {
  tabs: TabProps[];
  pills?: boolean;
  fullWidth?: boolean;
};

const Tab = ({ label, content }: TabProps) => (
  <div className="tab-pane active" aria-labelledby={label}>
    {content}
  </div>
);

const Tabs = ({ tabs, pills = false, fullWidth = false }: TabsProps) => {
  const [activeTabIndex, setActiveTabIndex] = useState(0);

  const handleTabClick = (index: number) => {
    setActiveTabIndex(index);
  };

  return (
    <div className={cx('tabs-container', fullWidth && 'full-width')}>
      <div className={cx('tabs', pills && 'pills')}>
        {tabs.map((tab, index) => (
          <div
            className={cx('tab', index === activeTabIndex && 'active')}
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
