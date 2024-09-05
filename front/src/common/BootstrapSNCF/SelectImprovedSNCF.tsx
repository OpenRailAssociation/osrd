import { useState, useEffect, type ReactNode, useCallback, useMemo } from 'react';

import cx from 'classnames';
import { isObject, isNil } from 'lodash';

import { type SelectOptionObject, getOptionLabel, getOptionValue } from './SelectSNCF';

interface SelectProps<T> {
  inline?: boolean;
  label?: ReactNode;
  options: T[];
  value?: T;
  onChange: (value: T) => void;
  sm?: boolean;
  blockMenu?: boolean; // if false, the menu will cover the elements below the select
  withSearch?: boolean;
  withNewValueInput?: boolean;
  addButtonTitle?: string;
  bgWhite?: boolean;
  dataTestId?: string;
  isOpened?: boolean;
  setSelectVisibility?: (arg: boolean) => void;
  noTogglingHeader?: boolean;
  disableShadow?: boolean; // if true, the shadow will not be displayed when the menu is open
  disabled?: boolean;
}

function SelectImproved<T extends string | SelectOptionObject>({
  inline,
  label,
  options,
  value,
  onChange,
  sm,
  withSearch,
  withNewValueInput,
  addButtonTitle = 'Add',
  bgWhite,
  dataTestId,
  blockMenu = false,
  isOpened = false,
  setSelectVisibility,
  noTogglingHeader = false,
  disableShadow = false,
  disabled,
}: SelectProps<T>) {
  const [isOpen, setIsOpen] = useState(isOpened);
  const [selectedItem, setSelectedItem] = useState<T | undefined>(value);
  const [filteredOptions, setFilteredOptions] = useState<Array<T>>(options);
  const [filterText, setFilterText] = useState('');
  const filterOptions = useCallback(
    (text: string) => {
      const localFilteredOptions = options.filter((el) =>
        typeof el === 'string'
          ? el.toLowerCase().includes(text.toLowerCase())
          : el.label.toLowerCase().includes(text.toLowerCase())
      );
      setFilteredOptions(text ? localFilteredOptions : options);
    },
    [options, setFilteredOptions]
  );

  const selectItem = useCallback(
    (selectedOption: T) => {
      setSelectedItem(selectedOption);
      onChange(selectedOption);
      setIsOpen(false);
    },
    [setSelectedItem, onChange, setIsOpen]
  );

  useEffect(() => {
    setSelectedItem(value);
  }, [value]);

  useEffect(() => {
    filterOptions(filterText);
  }, [filterOptions, filterText]);

  const renderNewValueInput = (currentValue: string) => (
    <div className="select-menu-item" role="listitem">
      <div className="d-flex flex-column flex-sm-row" data-role="add">
        <div className="form-control-container w-100 has-left-icon">
          <button
            disabled={disabled}
            type="button"
            className="btn btn-primary btn-block btn-sm"
            onClick={() => {
              const item = (
                options.length > 0 && isObject(options[0])
                  ? { id: currentValue, label: currentValue }
                  : currentValue
              ) as T;
              // We force the type, because we detect the type of the value with the options.
              // if options are empty, we possibly have a problem (default is string)
              selectItem(item);
            }}
          >
            {addButtonTitle}
          </button>
        </div>
      </div>
    </div>
  );

  const renderSelectedItem = () => {
    if (isNil(selectedItem)) return null;
    return getOptionLabel(selectedItem);
  };

  const optionsComponents = useMemo(
    () =>
      filteredOptions.map((option) => (
        <span className="select-menu-item" role="listitem" key={getOptionValue(option)}>
          <button type="button" disabled={disabled} onClick={() => selectItem(option)}>
            {getOptionLabel(option)}
          </button>
        </span>
      )),
    [filteredOptions, selectItem]
  );

  const shouldDisplayNewInputValue =
    withNewValueInput &&
    filterText.length > 0 &&
    !filteredOptions.map((e) => (isObject(e) ? e.label : e)).includes(filterText);

  return (
    <div className={cx({ 'd-flex align-items-baseline': inline })} data-testid={dataTestId}>
      {label && (
        <label htmlFor="select1" className={cx({ 'pr-2': inline })}>
          {label}
        </label>
      )}
      <div className={cx('select-improved', { active: isOpen })}>
        <div className="select-control">
          {!noTogglingHeader && (
            <div
              className={cx('input-group', { 'input-group-sm': sm })}
              tabIndex={0}
              role="button"
              onClick={() => {
                if (disabled) return;
                setIsOpen(!isOpen);
              }}
            >
              <p
                className={cx('form-control is-placeholder d-flex align-items-center', {
                  'bg-white': bgWhite,
                })}
                style={sm ? { minHeight: '1.813rem' } : undefined}
              >
                {renderSelectedItem()}
              </p>
              <div className="input-group-append input-group-last">
                <button
                  className="btn btn-primary btn-only-icon"
                  style={sm ? { minHeight: '1.813rem' } : undefined}
                  aria-label="toggle selection display"
                  type="button"
                  aria-expanded="false"
                  aria-controls="selecttoggle"
                  disabled={disabled}
                >
                  <i
                    className={`${isOpen ? 'icons-arrow-up' : 'icons-arrow-down'} icons-size-x75`}
                    aria-hidden="true"
                  />
                </button>
              </div>
            </div>
          )}
          <div
            id="-selecttoggle"
            className={cx('select-menu', {
              'add-border-top': noTogglingHeader,
              'position-relative': blockMenu,
            })}
          >
            <div className="d-flex flex-column">
              {withSearch && (
                <div className="form-control-container w-100 has-left-icon mb-3">
                  <input
                    className="form-control form-control-sm clear-option"
                    onChange={(e) => setFilterText(e.target.value)}
                    value={filterText}
                    disabled={disabled}
                  />
                  <span className="form-control-state" />
                  <span className="form-control-icon">
                    <i className="icons-search" aria-hidden="true" />
                  </span>
                  {filterText && (
                    <button
                      type="button"
                      className="btn-clear btn-primary"
                      style={{ width: '2em', height: '2em' }}
                      onClick={() => setFilterText('')}
                      disabled={disabled}
                    >
                      <span className="sr-only">Clear text</span>
                      <i className="icons-close" aria-hidden="true" />
                    </button>
                  )}
                </div>
              )}
              <div className="flex-fluid overflow-y" role="list" data-role="menu">
                {optionsComponents}
                {shouldDisplayNewInputValue && renderNewValueInput(filterText)}
              </div>
            </div>
          </div>
        </div>
      </div>
      {!disableShadow && isOpen && (
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
          aria-label="close selection display"
          tabIndex={0}
          onClick={() => {
            if (disabled) return;

            setIsOpen(false);
            if (setSelectVisibility) setSelectVisibility(false);
          }}
        >
          &nbsp;
        </div>
      )}
    </div>
  );
}

export default SelectImproved;
export type { SelectOptionObject };
