import { LIST_VALUES_SIGNAL_BASE, SIGNAL_BASE_DEFAULT } from 'applications/osrd/components/Simulation/consts';
import PropTypes, { string } from 'prop-types';

import SwitchSNCF from 'common/BootstrapSNCF/SwitchSNCF/SwitchSNCF'

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

export default SignalSwitch

