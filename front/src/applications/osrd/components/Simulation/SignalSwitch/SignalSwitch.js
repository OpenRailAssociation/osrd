import { LIST_VALUES_SIGNAL_BASE, SIGNAL_BASE_DEFAULT } from 'applications/osrd/components/Simulation/consts';
import { useDispatch, useSelector } from 'react-redux';

import SwitchSNCF from 'common/BootstrapSNCF/SwitchSNCF/SwitchSNCF'
import { updateSignalBase } from "reducers/osrdsimulation";

const SignalSwitch = () => {

  const {signalBase} = useSelector((state) => state.osrdsimulation);
  const dispatch = useDispatch();
  /**
   *
   * @param {SyntheticBaseEvent} e the Event triggered by the signal UI
   */
   const toggleSignal = (e) => {
    const newSignal = e?.target?.value;
    if (typeof newSignal !== 'undefined') {
      dispatch(updateSignalBase(newSignal));
    }
    else {
      console.warn('Try to toggle Signal with unavailableValue')
    }
  };

  return (
  <SwitchSNCF
    type="inline"
    options={LIST_VALUES_SIGNAL_BASE.map((val) => ({ value: val, label: val }))}
    id="signaBase"
    name="signalBase"
    checkedName={signalBase}
    onChange={(e) => toggleSignal(e)}
  />
  )

}

export default SignalSwitch
