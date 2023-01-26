import React, { useState } from 'react';
import PropTypes from 'prop-types';
import nextId from 'react-id-generator';

const color2classes = (color) => {
  switch (color) {
    case 'secondary':
      return 'bg-secondary';
    case 'purple':
      return 'bg-purple';
    case 'pink':
      return 'bg-pink';
    case 'red':
      return 'bg-red';
    case 'orange':
      return 'bg-orange';
    case 'yellow':
      return 'bg-yellow text-dark';
    case 'green':
      return 'bg-green text-dark';
    case 'teal':
      return 'bg-teal text-dark';
    case 'cyan':
      return 'bg-cyan';
    case 'white':
      return 'bg-white text-dark';
    default:
      return '';
  }
};

export default function ChipsSNCF(props) {
  const { addTag, tags, title, removeTag, color } = props;
  const [chipInputValue, setChipInputValue] = useState('');

  const chip = (label, idx) => (
    <div role="list" key={nextId()}>
      <div className="chips-group" role="listitem">
        <span className={`chips chips-label pr-1 ${color2classes(color)}`}>{label}</span>
        <button
          type="button"
          className={`chips chips-btn chips-only-icon ${color2classes(color)}`}
          onClick={() => removeTag(idx)}
        >
          <i className="icons-close" aria-hidden="true" />
        </button>
      </div>
    </div>
  );

  const validateInput = (e) => {
    if (e.key === 'Enter') {
      addTag(e.target.value);
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
        {tags.map((label, idx) => chip(label, idx))}
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
  tags: PropTypes.array.isRequired,
  removeTag: PropTypes.func.isRequired,
  addTag: PropTypes.func.isRequired,
  color: PropTypes.string,
};
ChipsSNCF.defaultProps = {
  title: null,
  color: 'primary',
};
