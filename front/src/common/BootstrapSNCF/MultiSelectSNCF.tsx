import React, { useCallback, useEffect, useMemo, useState } from 'react';

type MultiSelectSNCFProps = {
  multiSelectTitle: string;
  multiSelectSubTitle?: string;
  selectOptions: { label: string }[];
  onChange: React.Dispatch<React.SetStateAction<string[]>>;
  selectedValues: string[];
  isSelectAll?: boolean;
};

const MultiSelectSNCF = ({
  multiSelectTitle,
  multiSelectSubTitle,
  selectOptions,
  onChange,
  selectedValues,
  isSelectAll,
}: MultiSelectSNCFProps) => {
  const [multiSelectToggle, setMultiselectToggle] = useState<boolean>(false);
  const [selectAll, setSelectAll] = useState<boolean>(false);

  const renderOptions = useCallback(
    (options: { label: string }[]) =>
      options.map((selectOption, index) => (
        <option
          data-id={index}
          selected={selectedValues.includes(selectOption.label)}
          key={`selectOption-${selectOption.label}`}
          value={selectOption.label}
        >
          {selectOption.label}
        </option>
      )),
    [selectOptions]
  );

  const renderSelectToggles = (options: { label: string }[]) =>
    options.map((toggle, index) => {
      const { label } = toggle;
      const isChecked = selectedValues.includes(label);
      const onClickToggle = () => {
        onChange(
          isChecked
            ? [...selectedValues.filter((selectValue) => selectValue !== label)]
            : (prevValues) => [...prevValues, label]
        );
      };
      return (
        <div className="select-menu-item" role="listitem" key={`selectToggle-${label}`}>
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
              {label}
            </button>
          </div>
        </div>
      );
    });

  const memoizedAllOptionsLabel = useMemo(
    () => selectOptions.map((option) => option.label),
    [selectOptions]
  );

  useEffect(() => {
    const isAllSelected = memoizedAllOptionsLabel.every((label) => selectedValues.includes(label));
    if (isAllSelected && !selectAll) setSelectAll(true);
    if (!isAllSelected && selectAll) setSelectAll(false);
  }, [selectedValues]);

  useEffect(() => {
    const isAllSelected = memoizedAllOptionsLabel.every((label) => selectedValues.includes(label));
    const selects = isAllSelected ? [] : selectedValues;
    onChange(selectAll ? [...memoizedAllOptionsLabel] : selects);
  }, [selectAll]);

  return (
    <>
      <label htmlFor={`multiSelect-${multiSelectTitle}`}>{multiSelectTitle}</label>
      <div
        className={`select-improved ${multiSelectToggle && 'active'}`}
        data-component="select-multiple"
      >
        <div className="select-control">
          <div className="input-group" data-role="select-toggle">
            <div className="form-control">
              {isSelectAll ? (
                <div className="custom-control custom-checkbox">
                  <button
                    type="button"
                    data-role="value"
                    role="checkbox"
                    aria-checked="false"
                    className={`custom-control-label font-weight-medium ${selectAll && 'active'}`}
                    onClick={() => setSelectAll((prevState) => !prevState)}
                  >
                    {multiSelectSubTitle || multiSelectTitle}
                  </button>
                </div>
              ) : (
                multiSelectSubTitle || multiSelectTitle
              )}
            </div>
            <select
              className="sr-only"
              id={`multiSelect-${multiSelectTitle}`}
              multiple
              defaultValue={selectedValues}
              aria-expanded="true"
            >
              {selectOptions && renderOptions(selectOptions)}
            </select>
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
              {selectOptions && renderSelectToggles(selectOptions)}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default MultiSelectSNCF;
