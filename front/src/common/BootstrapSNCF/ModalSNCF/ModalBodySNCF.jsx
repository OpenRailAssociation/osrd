import React from 'react';
import PropTypes from 'prop-types';

export default function ModalBodySNCF(props) {
  const { children } = props;
  return <div className="modal-body">{children}</div>;
}

ModalBodySNCF.defaultProps = {
  children: undefined,
};

ModalBodySNCF.propTypes = {
  children: PropTypes.any,
};
