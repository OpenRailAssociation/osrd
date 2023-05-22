import SelectImprovedSNCF from 'common/BootstrapSNCF/SelectImprovedSNCF';
import React, { InputHTMLAttributes, useState } from 'react';

const FAKEDATA = ['25000V A', '25000V B', '1500V', '850V'];

type CatenaryInputProps = {
  value: string;
  onChange: (newCatenary?: string) => void;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'>;

const CatenaryInput = ({ onChange, value, ...attrs }: CatenaryInputProps) => {
  return (
    <SelectImprovedSNCF
      {...attrs}
      options={FAKEDATA}
      selectedValue={value}
      onChange={(e) => {
        onChange(e.target.value);
      }}
      withSearch={true}
    />
  );
};

export default CatenaryInput;
