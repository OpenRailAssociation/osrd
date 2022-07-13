import React, { useState } from 'react';
import PropTypes from 'prop-types';
import nextId from 'react-id-generator';
import './ChipsSNCF.scss';

export default function ChipsSNCF(props) {
  const {
    addLabel, labels, title, removeLabel,
  } = props;
  const [chipInputValue, setChipInputValue] = useState('');

  const chip = (label, idx) => (
    <div role="list">
      <div className="chips-group" role="listitem">
        <span className="chips chips-label pr-1">{label}</span>
        <button
          type="button"
          className="chips chips-btn chips-only-icon"
          onClick={() => removeLabel(idx)}
        >
          <i className="icons-close" aria-hidden="true" />
        </button>
      </div>
    </div>
  );

  const validateInput = (e) => {
    if (e.key === 'Enter') {
      addLabel(e.target.value);
      setChipInputValue('');
    }
  };

  const chipsID = `chipsSNCF${nextId()}`;
  return (
    <>
      {title ? (
        <label className="font-weight-medium mb-2" htmlFor={chipsID}>
          {title}
        </label>
      ) : null}
      <div className="form-control-container form-chips-container">
        {labels.map((label, idx) => chip(label, idx))}
        <input
          data-role="typewriter"
          type="text"
          className="chips-input stretchy"
          id={chipsID}
          onKeyDown={validateInput}
          value={chipInputValue}
          onChange={(e) => setChipInputValue(e.target.value)}
        />
      </div>
    </>
  );
}

ChipsSNCF.propTypes = {
  title: PropTypes.string,
  labels: PropTypes.array.isRequired,
  removeLabel: PropTypes.func.isRequired,
  addLabel: PropTypes.func.isRequired,
};
ChipsSNCF.defaultProps = {
  title: null,
};
