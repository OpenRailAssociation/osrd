import React, { Component } from 'react';
import PropTypes from 'prop-types';
import logo from 'assets/logo_osrd_seul_blanc.svg';
import './Caption.css';
import nextId from 'react-id-generator';

class Caption extends Component {
  static propTypes = {
    items: PropTypes.array.isRequired,
  }

  render() {
    const { items } = this.props;

    return (
      <div className="caption mr-3 p-3">
        {
          items.map((item) => (
            <div className="d-flex align-items-center" key={`${item}${nextId()}`}>
              <div>
                <img
                  src={logo}
                  alt={`${item}_caption`}
                  className="caption-img"
                />
              </div>
              <div>
                {item.label}
              </div>
            </div>
          ))
        }
      </div>
    );
  }
}

export default Caption;
