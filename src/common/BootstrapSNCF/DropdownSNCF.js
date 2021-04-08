import React from 'react';
import PropTypes from 'prop-types';
import nextId from 'react-id-generator';

export const DROPDOWN_STYLE_TYPES = {
  primary: 'btn-primary btn-sm',
  transparent: 'btn-transparent',
};

const DropdownSNCF = ({ titleContent, items, type }) => {
  const itemNode = items.map((item) => (
    <li className="dropdown-item" key={`item-${nextId()}`}>
      {item}
    </li>
  ));

  return (
    <div className="btn-group dropdown">
      <button
        className={`${type} btn dropdown-toggle toolbar-item-spacing}`}
        type="button"
        id="dropdownMenuButton"
        data-toggle="dropdown"
        aria-haspopup="true"
        aria-expanded="false"
        aria-controls="mycontrol"
      >
        {titleContent}
        <i className="icons-arrow-down d-none d-xl-block" aria-hidden="true" />
      </button>
      <div className="dropdown-menu dropdown-menu-right" aria-labelledby="dropdownMenuButton" id="mycontrol">
        <ul>
          {itemNode}
        </ul>
      </div>
    </div>
  );
};

DropdownSNCF.propTypes = {
  titleContent: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.object,
  ]).isRequired,
  items: PropTypes.arrayOf(PropTypes.node).isRequired,
  type: PropTypes.oneOf(Object.values(DROPDOWN_STYLE_TYPES)).isRequired,
};

export default DropdownSNCF;
