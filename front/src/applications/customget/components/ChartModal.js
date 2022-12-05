import 'applications/customget/components/ChartModal.scss';

import React, { useEffect, useState, useCallback } from 'react';
import { useDispatch } from 'react-redux';

import PropTypes from 'prop-types';
import { updateMustRedraw } from 'reducers/osrdsimulation/actions';
import { useTranslation } from 'react-i18next';

function ChartModal(props) {
  const { type, setShowModal, trainName, offsetTimeByDragging } = props;
  const dispatch = useDispatch();
  const { t } = useTranslation(['simulation']);
  const [offset, setOffset] = useState('');

  // ADN: just do an upadteSimulation, should do the rest
  const sendOffset = useCallback(
    ({ key }) => {
      if (key === 'Enter') {
        setShowModal('');
        const seconds = parseInt(type === '-' ? offset * -1 : offset, 10);
        offsetTimeByDragging(seconds);
        dispatch(updateMustRedraw(true));
      }
    },
    [setShowModal, offsetTimeByDragging, dispatch, offset, type]
  );

  useEffect(() => {
    window.addEventListener('keydown', sendOffset);
    return () => {
      window.removeEventListener('keydown', sendOffset);
    };
  }, [offset, sendOffset]);

  return (
    <div className="osrd-simulation-chart-modal">
      <div className="chart-modal-box">
        <div className="chart-modal-type-title">
          <span className="mr-1">{t('simulation:ManualOffset')}</span>
          {trainName}
        </div>
        <div className="chart-modal-input">
          <div className="chart-modal-type-label">{type}</div>
          <input
            type="string"
            autoFocus // eslint-disable-line jsx-a11y/no-autofocus
            onBlur={() => setShowModal('')}
            onChange={(e) => setOffset(e.target.value.replace(/\D/g, ''))} // Filter non digit chars
            value={offset}
          />
          <div className="chart-modal-type-unit">s</div>
        </div>
      </div>
    </div>
  );
}

ChartModal.propTypes = {
  type: PropTypes.string.isRequired,
  trainName: PropTypes.string.isRequired,
  setShowModal: PropTypes.func.isRequired,
  offsetTimeByDragging: PropTypes.func.isRequired,
};

export default ChartModal;
