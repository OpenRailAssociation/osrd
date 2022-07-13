import React from 'react';
import PropTypes from 'prop-types';

export default class ModalFooterSNCF extends React.Component {
  static propTypes = {
    children: PropTypes.oneOfType([
      PropTypes.object,
      PropTypes.string,
    ]).isRequired,
  }

  render() {
    const { children } = this.props;
    return (
      <div className="modal-footer">
        {children}
      </div>
    );
  }
}
