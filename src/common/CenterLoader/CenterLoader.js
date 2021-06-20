import React from 'react';
import PropTypes from 'prop-types';

export function CenterLoaderMini() {
  return (
    <div className="spinner-border" role="status">
      <span className="sr-only">Loading...</span>
    </div>
  );
}

export default function CenterLoader(props) {
  const { message } = props;
  return (
    <div className="center-loader">
      <div className="text-center">
        <h1 className="text-center">{message}</h1>
        <div className="spinner-border" role="status">
          <span className="sr-only">Loading...</span>
        </div>
      </div>
    </div>
  );
}

CenterLoader.propTypes = {
  message: PropTypes.string,
};
CenterLoader.defaultProps = {
  message: null,
};
