import React, { InputHTMLAttributes, ReactNode } from 'react';

export type InputSNCFProps = {
  id: string;
  type: string;
  name?: string;
  label?: JSX.Element | string;
  placeholder?: string;
  onChange?: InputHTMLAttributes<HTMLInputElement>['onChange'];
  value?: string | number;
  readonly?: boolean;
  inputProps?: Partial<InputHTMLAttributes<HTMLInputElement>>;
  min?: number;
  max?: number;
  list?: string;
  // Error handling
  isInvalid?: boolean;
  errorMsg?: string;
  // Clear button
  /** If a clear button must be displayed or not */
  clearButton?: boolean;
  /** The function called by the clear button */
  onClear?: () => void;
  // Options for the append icon
  appendOptions?: {
    label: string | React.ReactElement;
    onClick: () => void;
    name: string;
  };
  // Styling props
  unit?: ReactNode;
  sm?: boolean;
  whiteBG?: boolean;
  noMargin?: boolean;
  focus?: boolean;
  selectAllOnFocus?: boolean;
  step?: number;
  isFlex?: boolean;
  condensed?: boolean;
};

const InputSNCF = ({
  // Basic input props
  id,
  type,
  name = undefined,
  label = undefined,
  placeholder = undefined,
  onChange = undefined,
  value = undefined,
  readonly = false,
  inputProps = {},
  list = undefined,
  // Error handling
  isInvalid = false,
  errorMsg = undefined,
  // Clear button
  clearButton = false,
  onClear = undefined,
  // Options for the appened icon
  appendOptions = undefined,
  // Styling props
  unit = undefined,
  min = undefined,
  max = undefined,
  sm = false,
  whiteBG = false,
  noMargin = false,
  focus = false,
  selectAllOnFocus = false,
  step = 1,
  isFlex = false,
  condensed = false,
}: InputSNCFProps): JSX.Element => {
  // Build custom classes
  const formSize = sm ? 'form-control-sm' : '';
  const readOnlyFlag = readonly ? 'readonly' : '';
  const backgroundColor = whiteBG ? 'bg-white' : '';
  const clearOption = clearButton ? 'clear-option' : '';
  const flex = isFlex ? 'd-flex align-items-center' : '';
  const condensedIcon = condensed ? 'condensed-icon' : '';
  const condensedInput = condensed ? 'px-2' : '';

  // Test and adapt display if entry is invalid
  let invalidClass = '';
  let invalidMsg: JSX.Element | null = null;
  if (isInvalid) {
    invalidClass = 'is-invalid';
    invalidMsg = <div className="invalid-feedback">{errorMsg}</div>;
  }

  // Appends a icon button right next to the input field
  const appendButton = (small: boolean) => {
    const newFormSize = small ? 'btn-sm' : '';
    if (appendOptions) {
      return (
        <div className="input-group-append input-group-last">
          <button
            type="button"
            className={`${newFormSize} btn btn-primary btn-only-icon active`}
            onClick={appendOptions.onClick}
          >
            {appendOptions.label}
            <span className="sr-only">{appendOptions.name}</span>
          </button>
        </div>
      );
    }
    return null;
  };

  // Displays a button at the end of the input field to clear the input
  const addClearButton = () => {
    const displayClearButton = clearButton && value;

    // Returns null if the clear button is not used
    if (!displayClearButton) return null;

    // Else renders the button
    return (
      <button type="button" className="btn-clear btn-primary" onClick={onClear}>
        <span className="sr-only">Supprimer le texte</span>
        <i className="icons-close" aria-hidden="true" />
      </button>
    );
  };

  // Renders a basic input field without any underlying list
  const basicInput = () => {
    const inputComponent = (
      <>
        {label && (
          <label
            className={flex ? 'font-weight-medium mb-0 mr-2' : 'font-weight-medium mb-2'}
            htmlFor={id}
          >
            {label}
          </label>
        )}
        <div className={appendOptions ? 'input-group' : ''}>
          <div className={`form-control-container ${invalidClass} ${unit ? 'has-right-icon' : ''}`}>
            <input
              type={type}
              onChange={onChange}
              className={`form-control ${backgroundColor} ${formSize} ${readOnlyFlag} ${clearOption} ${condensedInput}`}
              id={id}
              name={name}
              value={value}
              placeholder={placeholder}
              ref={(input) => (focus ? input && input.focus() : null)}
              min={min}
              max={max}
              {...inputProps}
              step={step}
              onFocus={(e) => selectAllOnFocus && e.target.select()}
              list={list}
            />
            <span className="form-control-state" />
            {unit && <span className={`form-control-icon small ${condensedIcon}`}>{unit}</span>}
            {addClearButton()}
          </div>
          {sm && appendButton(sm)}
          {invalidMsg}
        </div>
      </>
    );

    return flex ? <div className={flex}>{inputComponent}</div> : inputComponent;
  };

  // Build conditional classes
  const containerMargin = noMargin ? '' : 'mb-4';

  return containerMargin ? <div className={containerMargin}>{basicInput()}</div> : basicInput();
};

export default InputSNCF;
