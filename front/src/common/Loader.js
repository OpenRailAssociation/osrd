import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import './Loader.scss';

export const Spinner = () => (
  <div className="spinner-border" role="status">
    <span className="sr-only">Loading...</span>
  </div>
);

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

export const LoaderFill = () => (
  <div className={`loader-fill inset-0`}>
    <Spinner />
  </div>
);

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
