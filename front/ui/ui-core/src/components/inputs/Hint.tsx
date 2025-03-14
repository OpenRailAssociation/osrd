import React from 'react';

type HintProps = {
  text: string;
};

const Hint = ({ text }: HintProps) => <span className="base-hint">{text}</span>;

export default Hint;
