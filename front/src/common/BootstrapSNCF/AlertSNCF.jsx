import React from 'react';
import PropTypes from 'prop-types';

export default function AlertSNCF(props) {
  const { title, children } = props;
  return (
    <div className="form-error mb-3">
      <h2 className="text-uppercase">{title}</h2>
      {children}
    </div>
  );
}

AlertSNCF.propTypes = {
  title: PropTypes.string.isRequired,
  children: PropTypes.object,
};

AlertSNCF.defaultProps = {
  children: '',
};
