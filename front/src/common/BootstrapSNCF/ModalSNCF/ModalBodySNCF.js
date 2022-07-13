import React from 'react';
import PropTypes from 'prop-types';

export default class ModalBodySNCF extends React.Component {
  static propTypes = {
    children: PropTypes.oneOfType([
      PropTypes.object,
      PropTypes.string,
    ]).isRequired,
  }

  render() {
    const { children } = this.props;
    return (
      <div className="modal-body">
        {children}
      </div>
    );
  }
}
