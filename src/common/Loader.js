import React from 'react';
import PropTypes from 'prop-types';

export default class Loader extends React.Component {
  static propTypes = {
    msg: PropTypes.string,
    center: PropTypes.bool,
  }

  static defaultProps = {
    msg: '',
    center: false,
  }

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
