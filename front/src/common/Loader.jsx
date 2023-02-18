import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import cx from 'classnames';
import './Loader.scss';

export function Spinner({ className, style } = { className: '', style: '' }) {
  return (
    <div className={className} style={style}>
      <div className="spinner-border" role="status">
        <span className="sr-only">Loading...</span>
      </div>
    </div>
  );
}

Spinner.propTypes = {
  className: PropTypes.string,
  style: PropTypes.object,
};

Spinner.defaultProps = {
  className: '',
  style: undefined,
};

export default class Loader extends React.Component {
  static propTypes = {
    msg: PropTypes.string,
    position: PropTypes.string, // center, top-left, top-right, bottom-right, bottom-left
  };

  static defaultProps = {
    msg: '',
    position: '',
  };

  render() {
    const { msg, position } = this.props;
    return (
      <div className={`loader ${position}`}>
        <Spinner />
        <div className="text-center mt-2">{msg}</div>
      </div>
    );
  }
}

export function LoaderFill({ className }) {
  return <Spinner className={cx(`loader-fill inset-0`, className)} />;
}
LoaderFill.propTypes = {
  className: PropTypes.string,
};
LoaderFill.defaultProps = {
  className: null,
};

/**
 * Same loader but plugged on the state.
 */
const stateToProps = (state) => ({
  loading: state.main.loading,
});

export const LoaderState = connect(stateToProps)(({ loading }) => {
  if (loading && loading > 0) return <Loader position="top-right" />;
  return null;
});
