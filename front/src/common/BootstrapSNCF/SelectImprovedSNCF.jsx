import React, { useState, useEffect } from 'react';
import './SelectImprovedSNCF.scss';

import PropTypes from 'prop-types';
import nextId from 'react-id-generator';

export default function SelectImprovedSNCF(props) {
  const { inline, title, options, selectedValue, onChange, sm, withSearch } = props;
  const [isOpen, setIsOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState();
  const [filteredOptions, setFilteredOptions] = useState(options);
  const [filterText, setFilterText] = useState('');

  const selectItem = (selectedOption) => {
    setSelectedItem(selectedOption);
    onChange(selectedOption);
    setIsOpen(false);
  };

  const renderOptions = () =>
    filteredOptions.map((option) => {
      const value = typeof option === 'string' ? option : option.value;
      return (
        <span className="select-menu-item" role="listitem" key={nextId()}>
          <button type="button" onClick={() => selectItem(option)}>
            {value}
          </button>
        </span>
      );
    });

  const addNewValue = (currentValue) => (
    <div className="d-flex pt-4 flex-column flex-sm-row" data-role="add">
      <div className="form-control-container w-100">
        <span className="form-control-state">{currentValue}</span>
      </div>
      <div className="pt-2 pt-sm-0 pl-sm-2">
        <button
          type="button"
          className="btn btn-primary btn-sm btn-block d-sm-inline-block"
          data-role="add-btn"
          title="Ajouter cet agent"
        >
          Ajouter
        </button>
      </div>
    </div>
  );

  const renderSelectedItem = () => {
    if (selectedItem) {
      return typeof selectedItem === 'string' ? selectedItem : selectedItem.value;
    }
    return null;
  };

  const filterOptions = (text) => {
    const localFilteredOptions = options.filter((el) =>
      typeof el === 'string'
        ? el.toLowerCase().includes(text.toLowerCase())
        : el.value.toLowerCase().includes(text.toLowerCase())
    );
    setFilteredOptions(text ? localFilteredOptions : options);
  };

  useEffect(() => {
    setSelectedItem(selectedValue);
  }, [selectedValue]);

  useEffect(() => {
    filterOptions(filterText);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterText, options]);

  return (
    <div className={inline ? 'd-flex align-items-baseline' : ''}>
      {title && (
        <label htmlFor="select1" className={inline ? 'pr-2' : ''}>
          {title}
        </label>
      )}
      <div className={`select-improved ${isOpen ? 'active' : ''}`}>
        <div className="select-control">
          <div
            className={`input-group ${sm ? 'input-group-sm' : ''}`}
            tabIndex={0}
            role="button"
            onClick={() => setIsOpen(!isOpen)}
          >
            <p
              className="form-control is-placeholder d-flex align-items-center"
              style={sm ? { minHeight: '1.813rem' } : undefined}
            >
              {renderSelectedItem()}
            </p>
            <div className="input-group-append input-group-last">
              <button
                className="btn btn-primary btn-only-icon"
                style={sm ? { minHeight: '1.813rem' } : undefined}
                type="button"
                aria-expanded="false"
                aria-controls="selecttoggle"
              >
                <i
                  className={`${isOpen ? 'icons-arrow-up' : 'icons-arrow-down'} icons-size-x75`}
                  aria-hidden="true"
                />
              </button>
            </div>
          </div>
          <div className="select-menu" id="-selecttoggle">
            <div className="d-flex flex-column">
              {withSearch && (
                <div className="form-control-container w-100 has-left-icon mb-3">
                  <input
                    className="form-control form-control-sm clear-option"
                    onChange={(e) => setFilterText(e.target.value)}
                    value={filterText}
                  />
                  <span className="form-control-state" />
                  <span className="form-control-icon">
                    <i className="icons-search" aria-hidden="true" />
                  </span>
                  {filterText && (
                    <button
                      type="button"
                      className="btn-clear btn-primary"
                      onClick={() => setFilterText('')}
                    >
                      <span className="sr-only">Clear text</span>
                      <i className="icons-close" aria-hidden="true" />
                    </button>
                  )}
                </div>
              )}
              <div className="flex-fluid overflow-y" role="list" data-role="menu">
                {renderOptions()}
              </div>
              {filterText && !filteredOptions.includes(filterText) && addNewValue(filterText)}
            </div>
          </div>
        </div>
      </div>
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            top: '0',
            left: '0',
            width: '100vw',
            height: '100vh',
            zIndex: 2,
          }}
          role="button"
          tabIndex={0}
          onClick={() => setIsOpen(false)}
        >
          &nbsp;
        </div>
      )}
    </div>
  );
}

SelectImprovedSNCF.propTypes = {
  inline: PropTypes.bool,
  options: PropTypes.array.isRequired,
  onChange: PropTypes.func.isRequired,
  sm: PropTypes.bool,
  selectedValue: PropTypes.oneOfType([PropTypes.object, PropTypes.string]),
  title: PropTypes.oneOfType([PropTypes.element, PropTypes.string]),
  withSearch: PropTypes.bool,
};

SelectImprovedSNCF.defaultProps = {
  inline: false,
  selectedValue: undefined,
  sm: false,
  title: null,
  withSearch: false,
};
