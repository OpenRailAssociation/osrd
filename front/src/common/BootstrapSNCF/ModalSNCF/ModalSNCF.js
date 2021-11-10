import React from 'react';
import PropTypes from 'prop-types';

export default class ModalSNCF extends React.Component {
  static propTypes = {
    children: PropTypes.oneOfType([
      PropTypes.object,
      PropTypes.array,
    ]).isRequired,
    htmlID: PropTypes.string.isRequired,
    size: PropTypes.string,
    optionalClasses: PropTypes.string,
  }

  static defaultProps = {
    size: undefined,
    optionalClasses: '',
  }

  render() {
    const {
      children,
      htmlID,
      size,
      optionalClasses,
    } = this.props;

    const modalClasses = (size !== undefined)
      ? `modal-dialog modal-dialog-centered modal-${size} ${optionalClasses}`
      : `modal-dialog modal-dialog-centered ${optionalClasses}`;

    return (
      <div className="modal fade" id={htmlID} tabIndex="-1" role="dialog" aria-hidden="true">
        <div className={modalClasses} role="document">
          <div className="modal-content">
            {children}
          </div>
        </div>
      </div>
    );
  }
}
