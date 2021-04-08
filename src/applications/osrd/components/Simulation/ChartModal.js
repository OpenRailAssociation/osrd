import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import 'applications/osrd/components/Simulation/ChartModal.scss';

const ChartModal = (props) => {
  const {
    type, setShowModal, trainName, offsetTimeByDragging, setMustRedraw,
  } = props;
  const { t } = useTranslation();
  const [offset, setOffset] = useState('');

  const sendOffset = ({ key }) => {
    if (key === 'Enter') {
      setShowModal('');
      const seconds = parseInt(type === '-' ? offset * -1 : offset, 10);
      offsetTimeByDragging(seconds);
      setMustRedraw(true);
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
          <span className="mr-1">{t('osrd.simulation.ManualOffset')}</span>
          {trainName}
        </div>
        <div className="chart-modal-input">
          <div className="chart-modal-type-label">
            {type}
          </div>
          <input
            type="string"
            autoFocus
            onBlur={() => setShowModal('')}
            onChange={(e) => setOffset(e.target.value.replace(/\D/g, ''))} // Filter non digit chars
            value={offset}
          />
          <div className="chart-modal-type-unit">s</div>
        </div>
      </div>
    </div>
  );
};

ChartModal.propTypes = {
  type: PropTypes.string.isRequired,
  trainName: PropTypes.string.isRequired,
  setShowModal: PropTypes.func.isRequired,
  offsetTimeByDragging: PropTypes.func.isRequired,
  setMustRedraw: PropTypes.func.isRequired,
};

export default ChartModal;
