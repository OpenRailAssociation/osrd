import React from 'react';
import PropTypes from 'prop-types';

/**
 * Progress bars & radial progress bars
 * They could have label (with label), progress bar can be small (with small)
 * Value have to be indicated (with value)
 *
 * @component
 * @example
 * const value = 'number'
 * const label = 'string'
 * const small = false
 * const radial = false
 * return (
 *  <ProgressSNCF
 *    value={value}
 *    hasLabel={hasLabel}
 *    small={small}
 *    radial={radial}
 *  />
 * )
 */

class ProgressSNCF extends React.Component {
  static propTypes = {
    // Basic input props
    value: PropTypes.number.isRequired,
    label: PropTypes.string,
    small: PropTypes.bool,
    radial: PropTypes.bool,
  }

  static defaultProps = {
    // Basic input props
    label: '',
    small: false,
    radial: false,
  }

  renderProgressBar = () => {
    const {
      label, small, value,
    } = this.props;
    return (
      <div className={small ? 'progress progress-sm' : 'progress'}>
        <div className="progress-bar" role="progressbar" style={{ width: `${value}%` }} aria-valuenow={value} aria-valuemin="0" aria-valuemax="100">
          {label !== '' ? (
            <span className="progress-label">{label}</span>
          ) : ''}
        </div>
      </div>
    );
  }

  renderRadialProgressBar = () => {
    const {
      label, value,
    } = this.props;
    return (
      <div className="progress-circle" data-component="radial-progress">
        <svg className="progress-circle-figure" data-role="figure" width="120" height="120" viewBox="0 0 120 120" aria-hidden="true">
          <circle className="progress-circle-meter" cx="60" cy="60" r="54" strokeWidth="12" />
          <circle className="progress-circle-value" cx="60" cy="60" r="54" strokeWidth="12" />
        </svg>
        {label !== '' ? (
          <div className="progress-circle-label" data-role="label">
            <span>
              <span data-role="labelvalue">{label}</span>
            </span>
          </div>
        ) : ''}
        <input data-role="control" className="sr-only" type="progressbar" value={value} />
      </div>
    );
  }

  render() {
    const {
      radial,
    } = this.props;
    return radial ? this.renderRadialProgressBar() : this.renderProgressBar();
  }
}

export default ProgressSNCF;
