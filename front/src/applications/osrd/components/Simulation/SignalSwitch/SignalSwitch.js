import React from 'react';
import PropTypes from 'prop-types';

import { LIST_VALUES_SIGNAL_BASE } from 'applications/osrd/components/Simulation/consts';
import SwitchSNCF from 'common/BootstrapSNCF/SwitchSNCF/SwitchSNCF';

const defaultOptions = LIST_VALUES_SIGNAL_BASE.map((val) => ({ value: val, label: val }));
/**
 * RFC to display a switch adapted to Signal Display Logic
 * @param {object} See PropType
 * @returns JSX
 */
function SignalSwitch(props) {
  const { signalBase, toggleSignal, type, options = defaultOptions } = props;

  /*
  const [internSignalBase, setInternSignalBase] = useState(signalBase);

  React.useEffect(() => {
    setInternSignalBase(signalBase);
  }, [signalBase]);
*/

  return (
    <SwitchSNCF
      type={type}
      options={options}
      id="signaBase"
      name="signalBase"
      checkedName={signalBase}
      onChange={toggleSignal}
    />
  );
}

/**
 * PropTypes and DefultProps: ypeScript for the poor. Helps a lot though
 */
SignalSwitch.propTypes = {
  type: SwitchSNCF.propTypes.type,
  options: PropTypes.array.isRequired,
  signalBase: PropTypes.string.isRequired,
  toggleSignal: SwitchSNCF.propTypes.onChange,
};
SignalSwitch.defaultProps = {
  type: 'inline',
  toggleSignal: () => {},
};

export default SignalSwitch;
