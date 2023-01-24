import 'applications/operationalStudies/components/Simulation/ChartModal.scss';

import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import PropTypes from 'prop-types';
import { changeTrain } from 'applications/operationalStudies/components/Simulation/simulationHelpers';
import { updateMustRedraw } from 'reducers/osrdsimulation/actions';
import { useTranslation } from 'react-i18next';

function ChartModal(props) {
  const { type, setShowModal, trainName, offsetTimeByDragging } = props;
  const { selectedTrain } = useSelector((state) => state.osrdsimulation);
  const simulation = useSelector((state) => state.osrdsimulation.simulation.present);
  const dispatch = useDispatch();
  const { t } = useTranslation(['simulation']);
  const [offset, setOffset] = useState('');

  // ADN: just do an upadteSimulation, should do the rest
  const sendOffset = ({ key }) => {
    if (key === 'Enter') {
      setShowModal('');
      const seconds = parseInt(type === '-' ? offset * -1 : offset, 10);
      offsetTimeByDragging(seconds);
      changeTrain(
        {
          departure_time: simulation.trains[selectedTrain].base.stops[0].time + seconds,
        },
        simulation.trains[selectedTrain].id
      );
      dispatch(updateMustRedraw(true));
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
