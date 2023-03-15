import React, { FC, InputHTMLAttributes, ReactNode } from 'react';

const TextareaSNCF: FC<{
  // Basic input props
  id: string;
  label?: ReactNode;
  placeholder?: string;
  onChange?: InputHTMLAttributes<HTMLTextAreaElement>['onChange'];
  value?: string;
  readonly?: boolean;
  // Error handling
  isInvalid?: boolean;
  errorMsg?: string;
  // Styling props
  whiteBG?: boolean;
  focus?: boolean;
  selectAllOnFocus?: boolean;
  rows?: number;
}> = (props) => {
  const {
    id,
    // Basic input props
    label = '',
    placeholder,
    onChange,
    value,
    readonly,
    // Error handling
    isInvalid,
    errorMsg,
    // Clear button
    whiteBG,
    focus,
    selectAllOnFocus,
    rows = 5,
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
};

export default TextareaSNCF;
