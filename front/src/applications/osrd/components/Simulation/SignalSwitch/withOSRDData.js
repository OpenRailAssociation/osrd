import { useDispatch, useSelector } from 'react-redux';

import SignalSwitch from "./SignalSwitch";
import { updateSignalBase } from "reducers/osrdsimulation";

/**
 * HOC to provide store data
 * @param {RFC} Component
 * @returns RFC with OSRD Data. SignalSwitch
 */
 const withOSRDData = (Component) => (props) => {
  const {signalBase} = useSelector((state) => state.osrdsimulation);
  const dispatch = useDispatch();
  /**
   * Store update on toggle
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
  return <Component {...props} signalBase={signalBase} toggleSignal={toggleSignal}></Component>
}

const OSRDSwitchSNCF = withOSRDData(SignalSwitch)

export default OSRDSwitchSNCF