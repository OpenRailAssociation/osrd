import { useCallback, useEffect, useMemo, useState } from 'react';

import cx from 'classnames';

type MultiSelectSNCFProps = {
  multiSelectTitle: string;
  multiSelectPlaceholder: string;
  options: { group?: string; options: string[] }[];
  onChange: React.Dispatch<React.SetStateAction<string[]>>;
  selectedValues: string[];
  allowSelectAll?: boolean;
  disable?: boolean;
};

const MultiSelectSNCF = ({
  multiSelectTitle,
  multiSelectPlaceholder,
  options,
  onChange,
  selectedValues,
  allowSelectAll,
  disable = false,
}: MultiSelectSNCFProps) => {
  const [multiSelectToggle, setMultiselectToggle] = useState<boolean>(false);
  const [selectAll, setSelectAll] = useState<boolean>(false);
  const multiSelectOptions = useMemo(
    () => options.map((optionGroup) => optionGroup.options).flat(),
    [options]
  );

  const renderSelectToggles = useCallback(
    (selectOptions: string[]) =>
      selectOptions.map((selectOption, index) => {
        const isChecked = selectedValues.includes(selectOption);
        const onClickToggle = () => {
          onChange(
            isChecked
              ? [...selectedValues.filter((selectValue) => selectValue !== selectOption)]
              : (prevValues) => [...prevValues, selectOption]
          );
        };
        return (
          <div className="select-menu-item" role="listitem" key={`selectToggle-${selectOption}`}>
            <div className="custom-control custom-checkbox">
              <button
                type="button"
                data-role="value"
                data-target={index}
                role="checkbox"
                aria-checked="false"
                className={cx('custom-control-label w-100 text-left font-weight-medium', {
                  active: isChecked,
                })}
                onClick={onClickToggle}
              >
                {selectOption}
              </button>
            </div>
          </div>
        );
      }),
    [selectedValues]
  );

  useEffect(() => {
    if (disable) setMultiselectToggle(false);
  }, [disable]);

  useEffect(() => {
    const isAllSelected = multiSelectOptions?.length === selectedValues.length;
    if (isAllSelected) {
      setSelectAll(true);
    } else if (selectAll && !isAllSelected) {
      setSelectAll(false);
    }
  }, [selectedValues]);

  const handleSelectAll = (newSelectAll: boolean) => {
    if (newSelectAll && multiSelectOptions) {
      onChange(multiSelectOptions);
    } else {
      onChange([]);
    }
  };

  const formatSelectValues = (values: string[]) => {
    const valuesLength = values.length;
    return valuesLength < 5
      ? values.join(', ')
      : [...values.slice(0, 4), `+ ${valuesLength - 4}`].join(', ');
  };

  return (
    <>
      <label htmlFor={`multiSelect-${multiSelectTitle}`}>{multiSelectTitle}</label>
      <div
        className={`select-improved ${multiSelectToggle && 'active'}`}
        data-component="select-multiple"
      >
        <div className="select-control">
          <div className="input-group input-group-sm" data-role="select-toggle">
            <div className="form-control form-control-sm is-placeholder">
              {allowSelectAll ? (
                <div className="custom-control custom-checkbox">
                  <button
                    type="button"
                    data-role="value"
                    role="checkbox"
                    aria-checked="false"
                    className={`custom-control-label font-weight-light ${selectAll && 'active'}`}
                    onClick={() => handleSelectAll(!selectAll)}
                  >
                    {formatSelectValues(selectedValues) || multiSelectPlaceholder}
                  </button>
                </div>
              ) : (
                <div className="font-weight-light">
                  {formatSelectValues(selectedValues) || multiSelectPlaceholder}
                </div>
              )}
            </div>

            <div className="input-group-append input-group-last">
              <button
                className="btn btn-sm btn-primary btn-only-icon"
                data-role="btn"
                type="button"
                aria-expanded="false"
                aria-controls="multiselecttoggle"
                aria-label="toggle multi selection"
                disabled={disable}
                aria-disabled={disable}
                tabIndex={disable ? -1 : 0}
                onClick={() => setMultiselectToggle((prevState) => !prevState)}
              >
                <i className="icons-arrow-down icons-size-x75" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div id="multiselecttoggle" className="select-menu position-relative" data-role="menu">
            {options.map((selectOption, index) =>
              selectOption.group !== undefined ? (
                <div
                  role="listitem"
                  className="select-group"
                  key={`multiSelect-selectOption-${selectOption.group}`}
                >
                  <div className="select-group-head">
                    <span className="select-group-title text-uppercase">{selectOption.group}</span>
                  </div>
                  <div className="select-group-content" data-role="group" data-id="0" role="list">
                    {renderSelectToggles(selectOption.options)}
                  </div>
                </div>
              ) : (
                <div data-role="group" data-id="0" role="list" key={`group-${index}`}>
                  {renderSelectToggles(selectOption.options)}
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default MultiSelectSNCF;
