import React, { useState } from 'react';

import { Eye, EyeClosed } from '@osrd-project/ui-icons';
import cx from 'classnames';

import Input, { type InputProps } from './Input';

export type PasswordInputProps = InputProps;
const PasswordInput = React.forwardRef<HTMLInputElement, InputProps>(
  ({ inputFieldWrapperClassname, ...otherProps }, ref) => {
    const [showPassword, toggleShowPassword] = useState(false);

    return (
      <Input
        {...otherProps}
        type={showPassword ? 'text' : 'password'}
        trailingContent={{
          content: showPassword ? <EyeClosed /> : <Eye />,
          onClickCallback: () => toggleShowPassword(!showPassword),
        }}
        inputFieldWrapperClassname={cx('password-input', inputFieldWrapperClassname)}
        ref={ref}
      />
    );
  }
);

PasswordInput.displayName = 'PasswordInput';

export default PasswordInput;
