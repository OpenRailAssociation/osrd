import React, { useCallback, useEffect, useState } from 'react';

type MultiSelectSNCFProps = {
  multiSelectTitle: string;
  multiSelectPlaceholder: string;
  options: string[];
  onChange: React.Dispatch<React.SetStateAction<string[]>>;
  selectedValues: string[];
  allowSelectAll?: boolean;
};

const MultiSelectSNCF = ({
  multiSelectTitle,
  multiSelectPlaceholder,
  options,
  onChange,
  selectedValues,
  allowSelectAll,
}: MultiSelectSNCFProps) => {
  const [multiSelectToggle, setMultiselectToggle] = useState<boolean>(false);
  const [selectAll, setSelectAll] = useState<boolean>(false);

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
                className={`custom-control-label w-100 text-left font-weight-medium ${
                  isChecked ? 'active' : ''
                }`}
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
    const isAllSelected = options.length === selectedValues.length;
    if (isAllSelected) {
      setSelectAll(true);
    } else if (selectAll && !isAllSelected) {
      setSelectAll(false);
    }
  }, [selectedValues]);

  const handleSelectAll = (newSelectAll: boolean) => {
    if (newSelectAll) {
      onChange(options);
    } else {
      onChange([]);
    }
  };

  return (
    <>
      <label htmlFor={`multiSelect-${multiSelectTitle}`}>{multiSelectTitle}</label>
      <div
        className={`select-improved ${multiSelectToggle && 'active'}`}
        data-component="select-multiple"
      >
        <div className="select-control">
          <div className="input-group" data-role="select-toggle">
            <div className="form-control is-placeholder">
              {allowSelectAll ? (
                <div className="custom-control custom-checkbox">
                  <button
                    type="button"
                    data-role="value"
                    role="checkbox"
                    aria-checked="false"
                    className={`custom-control-label font-weight-medium ${selectAll && 'active'}`}
                    onClick={() => handleSelectAll(!selectAll)}
                  >
                    {selectedValues.join(', ') || multiSelectPlaceholder}
                  </button>
                </div>
              ) : (
                <div className="font-weight-medium">
                  {selectedValues.join(', ') || multiSelectPlaceholder}
                </div>
              )}
            </div>

            <div className="input-group-append input-group-last">
              <button
                className="btn btn-primary btn-only-icon"
                data-role="btn"
                type="button"
                aria-expanded="false"
                aria-controls="multiselecttoggle"
                onClick={() => setMultiselectToggle((prevState) => !prevState)}
              >
                <i className="icons-arrow-down icons-size-x75" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div id="multiselecttoggle" className="select-menu" data-role="menu">
            <div className="select-group" data-role="group" data-id="0" role="list">
              {options && renderSelectToggles(options)}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default MultiSelectSNCF;
