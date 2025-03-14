import React from 'react';

import { RequiredInput } from '@osrd-project/ui-icons';
import cx from 'classnames';

type LabelProps = {
  htmlFor: string;
  text: string;
  required?: boolean;
  hasHint?: boolean;
  disabled?: boolean;
  small: boolean;
};

const Label = ({ htmlFor, text, required, hasHint, disabled, small = false }: LabelProps) => (
  <div className={cx('base-label-wrapper', { 'has-hint': hasHint, small })}>
    {required && (
      <span className="required">
        <RequiredInput />
      </span>
    )}
    <label className={cx('label', { disabled: disabled })} htmlFor={htmlFor}>
      {text}
    </label>
  </div>
);

export default Label;
