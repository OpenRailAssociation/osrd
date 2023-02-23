import React, { useState } from 'react';

type TabProps = {
  label: string;
  content: React.ReactNode;
};

type TabsProps = {
  tabs: TabProps[];
};

const Tab = ({ label, content }: TabProps) => (
  <div className="tab-pane active" aria-labelledby={label}>
    {content}
  </div>
);

const Tabs = ({ tabs }: TabsProps) => {
  const [activeTabIndex, setActiveTabIndex] = useState(0);

  const handleTabClick = (index: number) => {
    setActiveTabIndex(index);
  };

  return (
    <div className="tabs">
      <div className="d-flex mt-2 mb-3">
        {tabs.map((tab, index) => (
          // eslint-disable-next-line jsx-a11y/no-static-element-interactions
          <div
            className={`tab pb-3 mr-4 ${index === activeTabIndex ? 'active' : ''}`}
            key={`tab-${tab.label}-${index}}`}
            onClick={() => handleTabClick(index)}
          >
            {tab.label}
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
