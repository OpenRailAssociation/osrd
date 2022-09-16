import PropTypes, { string } from 'prop-types';

import { LIST_VALUES_SIGNAL_BASE } from 'applications/osrd/components/Simulation/consts';
import SwitchSNCF from 'common/BootstrapSNCF/SwitchSNCF/SwitchSNCF';

/**
 * RFC to display a switch adapted to Signal Display Logic
 * @param {object} See PropType
 * @returns JSX
 */
function SignalSwitch(props) {
  const { signalBase, toggleSignal, type } = props;

  const options =
    props.options || LIST_VALUES_SIGNAL_BASE.map((val) => ({ value: val, label: val }));
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
  type: PropTypes.string.isRequired,
  id: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  options: PropTypes.array.isRequired,
  checkedName: PropTypes.string,
  toggleChange: PropTypes.func,
};
SignalSwitch.defaultProps = {
  type: 'inline',
};

export default SignalSwitch;
