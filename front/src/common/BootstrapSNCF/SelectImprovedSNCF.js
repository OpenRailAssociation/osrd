import React, { useState } from 'react';

import PropTypes from 'prop-types';

export default function SelectSNCF(props) {
  const {
    title, options, selectedValue, onChange, sm,
  } = props;
  const [isOpen, setIsOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(selectedValue);

  const selectItem = (selectedOption) => {
    setSelectedItem(selectedOption);
    setIsOpen(false);
  };

  const renderOptions = () => options.map((option) => {
    const key = (typeof option === 'string') ? option : option.key;
    const value = (typeof option === 'string') ? option : option.value;
    return (
      <span className="select-menu-item" role="listitem" key={key}>
        <button type="button" onClick={() => selectItem(option)}>
          {value}
        </button>
      </span>
    );
  });

  const renderSelectedItem = () => {
    if (selectedItem) {
      return typeof selectedItem === 'string' ? selectedItem : selectedItem.value;
    }
    return null;
  };

  return (
    <>
      {title && <label htmlFor="select1">{title}</label>}
      <div className={`select-improved ${isOpen && 'active'}`}>
        <div className="select-control">
          <div className="input-group" tabIndex={0} role="button" onClick={() => setIsOpen(!isOpen)}>
            <p className="form-control is-placeholder d-flex align-items-center">
              {renderSelectedItem()}
            </p>
            <div className="input-group-append input-group-last">
              <button className="btn btn-primary btn-only-icon " type="button" aria-expanded="false" aria-controls="selecttoggle">
                <i className="icons-arrow-down icons-size-x75" aria-hidden="true" />
                <span className="sr-only">Sélectionner</span>
              </button>
            </div>
          </div>
          <div className="select-menu" id="-selecttoggle">
            <div className="d-flex flex-column">
              <div className="flex-fluid overflow-y" role="list" data-role="menu">
                {renderOptions()}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

SelectSNCF.propTypes = {
  title: PropTypes.string,
  options: PropTypes.array.isRequired,
  selectedValue: PropTypes.oneOfType([
    PropTypes.object,
    PropTypes.string,
  ]),
  onChange: PropTypes.func.isRequired,
  sm: PropTypes.bool,
};

SelectSNCF.defaultProps = {
  title: null,
  selectedValue: undefined,
  sm: false,
};
