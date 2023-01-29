import React from 'react';

type Props = {
  number: number;
  label: string;
  done: boolean;
};

export default function StateStep({ number, label, done }: Props) {
  return (
    <div className={`study-details-state-step ${done ? 'done' : null}`}>
      <span className="study-details-state-step-number">{number}</span>
      <span className="study-details-state-step-label">{label}</span>
    </div>
  );
}
