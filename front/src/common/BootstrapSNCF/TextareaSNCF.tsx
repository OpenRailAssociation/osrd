import React, { type InputHTMLAttributes, type ReactNode } from 'react';

import cx from 'classnames';

type TextareaSNCFProps = {
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
};

const TextareaSNCF = (props: TextareaSNCFProps) => {
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
          className={cx('form-control', { 'bg-white': whiteBG, readonly })}
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
