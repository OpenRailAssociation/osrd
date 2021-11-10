import React, { Component } from 'react';
import PropTypes from 'prop-types';


export default class ListGroup extends Component {
  static propTypes = {
    children: PropTypes.oneOfType([
      PropTypes.array.isRequired,
      PropTypes.object.isRequired,
    ]).isRequired,
  }

  render() {
    const { children } = this.props;
    return (
      <ul className="list-group">
        {children}
      </ul>
    );
  }
}
