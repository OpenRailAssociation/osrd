import React, { InputHTMLAttributes, useState } from 'react';

type CatenaryInputProps = {
  onChange: (newCatenary?: string) => void;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'>;

const CatenaryInput = ({ onChange, ...attrs }: CatenaryInputProps) => {
  const [catenary, setCatenary] = useState<string>('');
  return (
    <input
      type="text"
      {...attrs}
      value={catenary}
      onChange={(e) => {
        setCatenary(e.target.value);
        onChange(e.target.value);
      }}
    />
  );
};

export default CatenaryInput;
