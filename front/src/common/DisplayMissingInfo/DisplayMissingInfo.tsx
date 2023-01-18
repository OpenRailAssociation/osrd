import React from 'react';

interface Props {
  array: string[];
  isCorrect: boolean;
}

const DisplayMissingInfo = (props: Props) => {
  const { array } = props;

  return (
    <div className="form-error mb-3">
      <ul>
        {array.map((elem: string) => (
          <li>{elem}</li>
        ))}
      </ul>
    </div>
  );
};

export default DisplayMissingInfo;
