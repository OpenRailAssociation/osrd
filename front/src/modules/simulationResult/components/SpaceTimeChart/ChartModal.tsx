import React, { useEffect, useState } from 'react';

import { useTranslation } from 'react-i18next';

import { onlyDigit } from 'utils/strings';

type ChartModalProsp = {
  modificationKey: '+' | '-';
  trainName: string;
  setShowModal: (showModal: '+' | '-' | '') => void;
  offsetTimeByDragging: (offset: number) => void;
};

/** Modal to delay or advance a train on the SpaceTimeChart */
const ChartModal = ({
  modificationKey,
  setShowModal,
  trainName,
  offsetTimeByDragging,
}: ChartModalProsp) => {
  const { t } = useTranslation(['simulation']);
  const [offset, setOffset] = useState('');

  const sendOffset = ({ key }: { key: string }) => {
    if (key === 'Enter') {
      setShowModal('');
      const seconds = modificationKey === '-' ? parseInt(offset, 10) * -1 : parseInt(offset, 10);
      offsetTimeByDragging(seconds);
    }
  };

  useEffect(() => {
    window.addEventListener('keydown', sendOffset);
    return () => {
      window.removeEventListener('keydown', sendOffset);
    };
  }, [offset]);

  return (
    <div className="osrd-simulation-chart-modal">
      <div className="chart-modal-box">
        <div className="chart-modal-type-title">
          <span className="mr-1">{t('simulation:ManualOffset')}</span>
          {trainName}
        </div>
        <div className="chart-modal-input">
          <div className="chart-modal-type-label">{modificationKey}</div>
          <input
            type="string"
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            onBlur={() => setShowModal('')}
            onChange={(e) => setOffset(onlyDigit(e.target.value))} // Filter non digit chars
            value={offset}
          />
          <div className="chart-modal-type-unit">s</div>
        </div>
      </div>
    </div>
  );
};

export default ChartModal;
