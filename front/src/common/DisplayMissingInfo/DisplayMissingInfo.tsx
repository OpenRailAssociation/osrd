import React from 'react';
import PropTypes from 'prop-types';

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

DisplayMissingInfo.propTypes = {
  missingInfoList: PropTypes.array.isRequired,
  isCorrect: PropTypes.bool.isRequired,
};

DisplayMissingInfo.defaultProps = {
  missingInfoList: [''],
  isCorrect: false,
};

export default DisplayMissingInfo;
