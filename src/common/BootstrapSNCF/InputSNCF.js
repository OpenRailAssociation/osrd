/* eslint-disable max-classes-per-file */
import React from 'react';
import PropTypes from 'prop-types';

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

class InputSNCF extends React.Component {
  static propTypes = {
    // Basic input props
    id: PropTypes.string.isRequired,
    type: PropTypes.string.isRequired,
    label: PropTypes.string,
    placeholder: PropTypes.string,
    onChange: PropTypes.func,
    value: PropTypes.string,
    readonly: PropTypes.bool,
    inputProps: PropTypes.object,
    min: PropTypes.number,
    max: PropTypes.number,
    // Error handling
    isInvalid: PropTypes.bool,
    errorMsg: PropTypes.string,
    // Clear button
    /** If a clear button must be displayed or not */
    clearButton: PropTypes.bool,
    /** The function called by the clear button */
    onClear: PropTypes.func,
    // Options for the appened icon
    appendOptions: PropTypes.shape({
      iconName: PropTypes.string.isRequired,
      onClick: PropTypes.func.isRequired,
      name: PropTypes.string.isRequired,
    }),
    // Styling props
    unit: PropTypes.string,
    sm: PropTypes.bool,
    whiteBG: PropTypes.bool,
    noMargin: PropTypes.bool,
    focus: PropTypes.bool,
  }

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
  }

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
  }

  // Displays a button at the end of the input field to clear the input
  renderClearButton = () => {
    const { value, clearButton, onClear } = this.props;

    const displayClearButton = clearButton && value && value.length !== 0;

    // Returns null if the clear button is not used
    if (!displayClearButton) return null;

    // Else renders the button
    return (
      <button type="button" className="btn-clear btn-primary" onClick={onClear}>
        <span className="sr-only">Supprimer le texte</span>
        <i className="icons-close" aria-hidden="true" />
      </button>
    );
  }

  // Renders a basic input field without any underlying list
  renderBasicInput = () => {
    const {
      isInvalid, errorMsg, focus, label, id, type, onChange, unit, sm,
      readonly, whiteBG, clearButton, value, placeholder, inputProps,
      min, max,
    } = this.props;

    // Build custom classes
    const formSize = sm ? 'form-control-sm' : '';
    const readOnlyFlag = readonly ? 'readonly' : '';
    const backgroundColor = whiteBG ? 'bg-white' : '';
    const clearOption = clearButton ? 'clear-option' : '';

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

    return (
      <>
        {label && (
        <label className="font-weight-medium mb-2" htmlFor={id}>{label}</label>
        )}
        <div className="input-group">
          <div className={`form-control-container ${invalidClass} ${unit ? 'has-left-icon' : null}`}>
            <input
              type={type}
              onChange={onChange}
              className={`form-control ${backgroundColor} ${formSize} ${readOnlyFlag} ${clearOption}`}
              id={id}
              value={value}
              placeholder={placeholder}
              ref={(input) => ((focus) ? input && input.focus() : null)}
              min={min || null}
              max={max || null}
              {...inputProps}
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
  }

  render() {
    const { noMargin } = this.props;

    // Build conditional classes
    const containerMargin = noMargin ? '' : 'mb-4';

    return (
      <div className={containerMargin}>
        {this.renderBasicInput()}
      </div>
    );
  }
}

export default InputSNCF;
