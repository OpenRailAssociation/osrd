import React from 'react';

interface Props {
  missingInfoList: string[];
  isCorrect: boolean;
}

const DisplayMissingInfo = (props: Props) => {
  const { missingInfoList } = props;

  return (
    <div className="form-error mb-2">
      <ul>
        {missingInfoList.map((missingInfo: string) => (
          <li>{missingInfo}</li>
        ))}
      </ul>
    </div>
  );
};

export default DisplayMissingInfo;
