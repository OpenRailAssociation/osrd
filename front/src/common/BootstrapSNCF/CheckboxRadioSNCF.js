import React from 'react';
import PropTypes from 'prop-types';

/**
 * Simple checkbox or renderRadio
 * You HAVE TO use same name for all radio components that need to work together
 *
 * @component
 * @example
 * const id = 'number'
 * const label = 'string'
 * const name = 'string'
 * const type = 'string'
 * return (
 *  <CheckboxSNCF
 *    id={value}
 *    label={label}
 *    name={name}
 *    type={type}
 *    checked=bool
 *  />
 * )
 */

class CheckboxRadioSNCF extends React.Component {
  static propTypes = {
    // Basic input props
    id: PropTypes.string.isRequired,
    label: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.object,
    ]).isRequired,
    name: PropTypes.string.isRequired,
    onChange: PropTypes.func.isRequired,
    type: PropTypes.string.isRequired,
    checked: PropTypes.bool,
  }

  static defaultProps = {
    checked: false,
  }

  renderCheckbox = () => {
    const {
      id,
      name,
      label,
      checked,
      onChange,
    } = this.props;
    return (
      <div className="custom-control custom-checkbox">
        <input type="checkbox" id={id} name={name} className="custom-control-input" checked={checked} onChange={onChange} />
        <label className="custom-control-label" htmlFor={id}>{label}</label>
      </div>
    );
  }

  renderRadio = () => {
    const {
      id,
      name,
      label,
      checked,
      onChange,
    } = this.props;
    return (
      <div className="custom-control custom-radio">
        <input type="radio" id={id} name={name} className="custom-control-input" checked={checked} onChange={onChange} />
        <label className="custom-control-label font-weight-medium" htmlFor={id}>{label}</label>
      </div>
    );
  }

  render() {
    const { type } = this.props;
    switch (type) {
      case 'radio':
        return this.renderRadio();
      default:
        return this.renderCheckbox();
    }
  }
}

export default CheckboxRadioSNCF;
