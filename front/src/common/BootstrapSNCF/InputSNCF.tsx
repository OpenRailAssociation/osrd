import React, { InputHTMLAttributes, ReactNode } from 'react';

/**
 * The InputSNCF component can be used for basic inputs as well as for advanced search inputs
 *
 * @component
 * @example
 * const id = 'custom-id'
 * const type = 'text'
 * const onChange = (e) => console.log(e.target.value)
 * const value = 'Some input'
 * const readonly = false
 * return (
 *  <InputSNCF
 *    id={id}
 *    type={type}
 *    onChange={onChange}
 *    value={value}
 *    readonly={readonly}
 *  />
 * )
 */

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
    iconName: string;
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
};

class InputSNCF extends React.Component<InputSNCFProps> {
  static defaultProps = {
    // Basic input props
    label: undefined,
    placeholder: undefined,
    onChange: undefined,
    value: undefined,
    readonly: false,
    inputProps: {},
    // Error handling
    isInvalid: false,
    errorMsg: undefined,
    // Clear button
    clearButton: false,
    onClear: undefined,
    // Options for the appened icon
    appendOptions: undefined,
    // Styling props
    unit: undefined,
    min: undefined,
    max: undefined,
    sm: false,
    whiteBG: false,
    noMargin: false,
    focus: false,
    selectAllOnFocus: false,
    step: 1,
    isFlex: false,
  };

  // Appends a icon button right next to the input field
  renderAppendButton = (sm = false) => {
    const { appendOptions } = this.props;
    const formSize = sm ? 'btn-sm' : '';
    if (appendOptions) {
      return (
        <div className="input-group-append input-group-last">
          <button
            type="button"
            className={`${formSize} btn btn-primary btn-only-icon active`}
            onClick={appendOptions.onClick}
          >
            <i className={appendOptions.iconName} aria-hidden="true" />
            <span className="sr-only">{appendOptions.name}</span>
          </button>
        </div>
      );
    }

    return null;
  };

  // Displays a button at the end of the input field to clear the input
  renderClearButton = () => {
    const { value, clearButton, onClear } = this.props;

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
  renderBasicInput = () => {
    const {
      isInvalid,
      errorMsg,
      focus,
      label,
      id,
      name,
      type,
      onChange,
      unit,
      sm,
      isFlex,
      readonly,
      whiteBG,
      clearButton,
      value,
      placeholder,
      inputProps,
      min,
      max,
      selectAllOnFocus,
      step,
    } = this.props;

    // Build custom classes
    const formSize = sm ? 'form-control-sm' : '';
    const readOnlyFlag = readonly ? 'readonly' : '';
    const backgroundColor = whiteBG ? 'bg-white' : '';
    const clearOption = clearButton ? 'clear-option' : '';
    const flex = isFlex ? 'd-flex align-items-center' : '';

    // Test and adapt display if entry is invalid
    let invalidClass = '';
    let invalidMsg = null;
    if (isInvalid) {
      invalidClass = 'is-invalid';
      invalidMsg = (
        <div className="invalid-feedback d-block" id="inputGroupPrepend">
          {errorMsg}
        </div>
      );
    }

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
        <div className="input-group">
          <div
            className={`form-control-container ${invalidClass} ${unit ? 'has-right-icon' : null}`}
          >
            <input
              type={type}
              onChange={onChange}
              className={`form-control ${backgroundColor} ${formSize} ${readOnlyFlag} ${clearOption}`}
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
            />
            <span className="form-control-state" />
            {unit ? <span className="form-control-icon small">{unit}</span> : null}
            {this.renderClearButton()}
          </div>
          {this.renderAppendButton(sm)}
          {invalidMsg}
        </div>
      </>
    );

    return flex ? <div className={flex}>{inputComponent}</div> : inputComponent;
  };

  render() {
    const { noMargin } = this.props;

    // Build conditional classes
    const containerMargin = noMargin ? '' : 'mb-4';

    return containerMargin ? (
      <div className={containerMargin}>{this.renderBasicInput()}</div>
    ) : (
      this.renderBasicInput()
    );
  }
}

export default InputSNCF;
