/* eslint-disable jsx-a11y/no-autofocus */
import { type InputHTMLAttributes, type ReactNode } from 'react';

import cx from 'classnames';

export type InputSNCFProps = {
  id: string;
  type: string;
  containerClass?: string;
  name?: string;
  label?: JSX.Element | string;
  placeholder?: string;
  title?: string;
  onChange?: InputHTMLAttributes<HTMLInputElement>['onChange'];
  value?: string | number;
  readonly?: boolean;
  inputProps?: Partial<InputHTMLAttributes<HTMLInputElement>>;
  min?: string | number;
  max?: string | number;
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
  step?: number | string;
  isFlex?: boolean;
  condensed?: boolean;
  textRight?: boolean;
  disabled?: boolean;
  ref?: React.MutableRefObject<HTMLInputElement>;
};

const InputSNCF = ({
  // Basic input props
  id,
  type,
  containerClass,
  name,
  label,
  placeholder,
  title,
  onChange,
  value,
  readonly = false,
  inputProps = {},
  list,
  // Error handling
  isInvalid = false,
  errorMsg,
  // Clear button
  clearButton = false,
  onClear,
  // Options for the appened icon
  appendOptions,
  // Styling props
  unit,
  min,
  max,
  sm = false,
  whiteBG = false,
  noMargin = false,
  focus = false,
  selectAllOnFocus = false,
  step = 1,
  isFlex = false,
  condensed = false,
  textRight = false,
  disabled = false,
  ref,
}: InputSNCFProps): JSX.Element => {
  // Build custom classes
  const textAlignmentClass = textRight ? 'right-alignment' : 'left-alignment';

  // Appends an icon button right next to the input field
  const appendButton = (small: boolean) => {
    if (appendOptions) {
      return (
        <div className="input-group-append input-group-last">
          <button
            type="button"
            className={cx('btn', 'btn-primary', 'btn-only-icon', 'active', { 'btn-sm': small })}
            onClick={appendOptions.onClick}
            disabled={disabled}
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
  const addClearButton = () => (
    <button type="button" className="btn-clear btn-primary" onClick={onClear}>
      <span className="sr-only">Supprimer le texte</span>
      <i className="icons-close" aria-hidden="true" />
    </button>
  );
  // Renders a basic input field without any underlying list
  const basicInput = () => {
    const inputComponent = (
      <>
        {label && (
          <label
            className={cx('font-weight-medium', { 'mb-0 mr-2': isFlex, 'mb-2': !isFlex })}
            htmlFor={id}
          >
            {label}
          </label>
        )}
        <div className={cx(containerClass, { 'input-group': appendOptions })}>
          <div
            className={cx('form-control-container', {
              'is-invalid': isInvalid,
              'has-right-icon': unit,
            })}
          >
            <input
              autoFocus={focus}
              type={type}
              onChange={onChange}
              className={cx('form-control', textAlignmentClass, {
                'bg-white': whiteBG,
                'clear-option': clearButton && value,
                'form-control-sm': sm,
                'px-2': condensed,
                readonly,
              })}
              id={id}
              name={name}
              value={disabled ? '' : value}
              placeholder={placeholder}
              title={title}
              ref={ref}
              min={min}
              max={max}
              disabled={disabled}
              {...inputProps}
              step={step}
              onFocus={(e) => selectAllOnFocus && e.target.select()}
              list={list}
            />
            <span className="form-control-state" />
            {unit && (
              <span className={cx('form-control-icon', 'small', { 'condensed-icon': condensed })}>
                {unit}
              </span>
            )}
            {clearButton && value && addClearButton()}
          </div>
          {sm && appendButton(sm)}
          {isInvalid && <div className="invalid-feedback">{errorMsg}</div>}
        </div>
      </>
    );

    return isFlex ? (
      <div className="d-flex align-items-center">{inputComponent}</div>
    ) : (
      inputComponent
    );
  };

  return noMargin ? basicInput() : <div className="mb-4">{basicInput()}</div>;
};

export default InputSNCF;
