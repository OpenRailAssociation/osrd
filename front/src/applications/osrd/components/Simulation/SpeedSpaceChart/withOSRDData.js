import React from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { LIST_VALUES_SIGNAL_BASE } from 'applications/osrd/components/Simulation/consts';
import { updateSignalBase } from 'reducers/osrdsimulation';
import SpeedSpaceChart from './SpeedSpaceChart';

/**
 * HOC to provide store data
 * @param {RFC} Component
 * @returns RFC with OSRD Data. SignalSwitch
 */
const withOSRDData = (Component) =>
  function WrapperComponent(props) {
    const { signalBase } = useSelector((state) => state.osrdsimulation);
    const dispatch = useDispatch();

    const options = LIST_VALUES_SIGNAL_BASE.map((val) => ({ value: val, label: val }));
    /**
     * Store update on toggle
     * @param {SyntheticBaseEvent} e the Event triggered by the signal UI
     */
    const toggleSignal = (e) => {
      const newSignal = e?.target?.value;
      if (typeof newSignal !== 'undefined') {
        dispatch(updateSignalBase(newSignal));
      } else {
        console.warn('Try to toggle Signal with unavailableValue');
      }
    };
    return (
      <Component {...props} signalBase={signalBase} toggleSignal={toggleSignal} options={options} />
    );
  };

const OSRDSwitchSNCF = withOSRDData(SignalSwitch);

export default OSRDSwitchSNCF;