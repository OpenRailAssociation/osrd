import React from 'react';
import PropTypes from 'prop-types';

export default class CenterLoader extends React.Component {
  static propTypes = {
    message: PropTypes.string,
  }

  static defaultProps = {
    message: '',
  }

  render() {
    const { message } = this.props;
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
}
