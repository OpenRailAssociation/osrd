import React, { useState } from 'react';
import PropTypes from 'prop-types';

interface Props {
  title: string;
  missingInfoList: string[];
  isShowing: boolean;
  isCorrect: boolean;
}

const DisplayMissingInfo = (props: Props) => {
  const { title, missingInfoList, isShowing } = props;

  const [isToggle, setIsToggle] = useState<boolean>(false);

  const handleClick = () => {
    setIsToggle(!isToggle);
  };

  return (
    <>
      {isShowing && (
        <div className="form-error bg-warning text-dark mb-2">
          <div className="d-flex align-items-center">
            <h2 className=" text-uppercase text-dark mr-1 mb-0">{title}</h2>
            <div role="button" className="btn btn-sm" onClick={() => handleClick()}>
              <i
                className={`icons-arrow-down ${isToggle ? 'icons-rotate-180' : ''} text-dark`}
                aria-hidden="true"
              ></i>
            </div>
          </div>
          {isToggle && (
            <ul>
              {missingInfoList.map((missingInfo: string) =>
                missingInfo.length ? <li>{missingInfo}</li> : null
              )}
            </ul>
          )}
        </div>
      )}
    </>
  );
};

DisplayMissingInfo.propTypes = {
  missingInfoList: PropTypes.array.isRequired,
  isShowing: PropTypes.bool.isRequired,
  isCorrect: PropTypes.bool.isRequired,
};

DisplayMissingInfo.defaultProps = {
  missingInfoList: [''],
  isShowing: false,
  isCorrect: false,
};

export default DisplayMissingInfo;
