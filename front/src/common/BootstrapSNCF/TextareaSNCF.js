import PropTypes from 'prop-types';
import React from 'react';

export default function TextareaSNCF(props) {
  const {
    isInvalid,
    errorMsg,
    focus,
    label,
    id,
    onChange,
    readonly,
    whiteBG,
    value,
    placeholder,
    selectAllOnFocus,
    rows,
  } = props;

  // Build custom classes
  const readOnlyFlag = readonly ? 'readonly' : '';
  const backgroundColor = whiteBG ? 'bg-white' : '';

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
    <div className="form-group mb-0">
      {label && (
        <label className="font-weight-medium mb-2" htmlFor={id}>
          {label}
        </label>
      )}
      <div className={`form-control-container ${invalidClass}`}>
        <textarea
          onChange={onChange}
          className={`form-control ${backgroundColor} ${readOnlyFlag}`}
          id={id}
          value={value}
          placeholder={placeholder}
          ref={(input) => (focus ? input && input.focus() : null)}
          onFocus={(e) => selectAllOnFocus && e.target.select()}
          rows={rows}
        />
        <span className="form-control-state" />
      </div>
      {invalidMsg}
    </div>
  );
}

TextareaSNCF.defaultProps = {
  // Basic input props
  label: '',
  placeholder: undefined,
  onChange: undefined,
  value: undefined,
  readonly: false,
  // Error handling
  isInvalid: false,
  errorMsg: undefined,
  // Clear button
  whiteBG: false,
  focus: false,
  selectAllOnFocus: false,
  rows: 5,
};

TextareaSNCF.propTypes = {
  // Basic input props
  id: PropTypes.string.isRequired,
  label: PropTypes.oneOfType([PropTypes.element, PropTypes.string]),
  placeholder: PropTypes.string,
  onChange: PropTypes.func,
  value: PropTypes.string,
  readonly: PropTypes.bool,
  // Error handling
  isInvalid: PropTypes.bool,
  errorMsg: PropTypes.string,
  // Styling props
  whiteBG: PropTypes.bool,
  focus: PropTypes.bool,
  selectAllOnFocus: PropTypes.bool,
  rows: PropTypes.number,
};
