import React from 'react';
import PropTypes from 'prop-types';
import './ChipsSNCF.scss';

export default function ChipsSNCF(props) {
  const { title } = props;

  const Chip = () => (
    <div role="list">
      <div className="chips-group" role="listitem">
        <span className="chips chips-label pr-1">Mathéo Mercier</span>
        <button type="button" className="chips chips-btn chips-only-icon">
          <span className="sr-only">Remove Mathéo Mercier</span>
          <i className="icons-close" aria-hidden="true" />
        </button>
      </div>
    </div>
  );

  return (
    <>
      {title ? (
        <label className="font-weight-medium mb-2" htmlFor="addreceivers1">
          {title}
        </label>
      ) : null}
      <div className="form-control-container form-chips-container">
        <Chip />
        <input data-role="typewriter" type="text" className="chips-input stretchy" id="addreceivers1" />
      </div>
    </>
  );
}

ChipsSNCF.propTypes = {
  title: PropTypes.string,
};
ChipsSNCF.defaultProps = {
  title: null,
};
