import React, { useState } from 'react';
import './DisplayMissingInfo.scss';

interface Props {
  title: string;
  missingInfoList: string[];
  isShowing: boolean;
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
            <button type="button" className="btn btn-sm outline-btn" onClick={() => handleClick()}>
              <i
                className={`icons-arrow-down ${isToggle ? 'icons-rotate-180' : ''} text-dark`}
                aria-hidden="true"
              />
            </button>
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

export default DisplayMissingInfo;
