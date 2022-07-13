import React from 'react';
import PropTypes from 'prop-types';

export default class FilterMenuItemSNCF extends React.Component {
  static propTypes = {
    htmlID: PropTypes.string.isRequired,
    checked: PropTypes.bool,
    title: PropTypes.string.isRequired,
    radio: PropTypes.bool,
    name: PropTypes.string,
    picture: PropTypes.string,
    value: PropTypes.string,
    onChange: PropTypes.func,
  }

  static defaultProps = {
    onChange: null,
    name: 'filters',
    radio: false,
    value: undefined,
    checked: false,
    picture: '',
  }

  render() {
    const {
      title, htmlID, checked, onChange, name, radio, picture, value,
    } = this.props;

    const filterPicture = (picture !== '') ? (<img alt="OSM" width="50" height="32" className="ml-1 rounded" src={picture} />) : ('');

    return (
      <div className="filters-menu-item has-hover">
        <div className="custom-control custom-checkbox ">
          <input
            type={radio ? 'radio' : 'checkbox'}
            name={name}
            className="custom-control-input"
            id={htmlID}
            checked={checked}
            onChange={onChange}
            value={value}
          />
          <label className="custom-control-label w-100" htmlFor={htmlID}>
            <div className="d-flex w-100">
              <div className="flex-grow-1">{title}</div>
              {filterPicture}
            </div>
          </label>
        </div>
      </div>
    );
  }
}
