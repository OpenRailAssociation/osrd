import { LIST_VALUES_SIGNAL_BASE, SIGNAL_BASE_DEFAULT } from 'applications/osrd/components/Simulation/consts';
import PropTypes, { string } from 'prop-types';
import { useDispatch, useSelector } from 'react-redux';

import SwitchSNCF from 'common/BootstrapSNCF/SwitchSNCF/SwitchSNCF'
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

/**
 * RFC to display a switch adapted to Signal Display Logic
 * @param {object} See PropType
 * @returns JSX
 */
const SignalSwitch = (props) => {

  const {signalBase, toggleSignal, type } = props

  return (
  <SwitchSNCF
    type={type}
    options={LIST_VALUES_SIGNAL_BASE.map((val) => ({ value: val, label: val }))}
    id="signaBase"
    name="signalBase"
    checkedName={signalBase}
    onChange={toggleSignal}
  />
  )

}

/**
 * PropTypes and DefultProps: ypeScript for the poor. Helps a lot though
 */
SignalSwitch.propTypes = {
  type: PropTypes.string.isRequired,
  id: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  options: PropTypes.array.isRequired,
  checkedName: PropTypes.string,
  toggleChange: PropTypes.func
}
SignalSwitch.defaultProps = {
  type: "inline"
}

const OSRDSwitchSNCF = withOSRDData(SignalSwitch)

export default OSRDSwitchSNCF
