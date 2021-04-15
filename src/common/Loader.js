import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';

export default class Loader extends React.Component {
  static propTypes = {
    msg: PropTypes.string,
    center: PropTypes.bool,
  };

  static defaultProps = {
    msg: '',
    center: false,
  };

  render() {
    const { msg, center } = this.props;
    const className = center ? 'loader center' : 'loader';
    return (
      <div className={className}>
        <div className="spinner-border" role="status">
          <span className="sr-only">Loading...</span>
        </div>
        <div className="text-center mt-2">{msg}</div>
      </div>
    );
  }
}

/**
 * Same loader but plugged on the state.
 */
const stateToProps = (state) => ({
  loading: state.main.loading,
});
export const LoaderState = connect(stateToProps)(({ loading }) => {
  if (loading && loading > 0) return <Loader center />;
  return null;
});
