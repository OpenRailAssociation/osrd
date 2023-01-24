import React, { useState } from 'react';
import PropTypes from 'prop-types';
import nextId from 'react-id-generator';

export const DROPDOWN_STYLE_TYPES = {
  primary: 'btn-primary btn-sm',
  transparent: 'btn-transparent',
};

function DropdownSNCF({ titleContent, items = [], type }) {
  const [isDropdownShown, setIsDropdownShown] = useState(false);
  const itemNode = items.map((item) => (
    <li
      className="dropdown-item"
      key={`item-${nextId()}`}
      // Make it better some day :-/
      // eslint-disable-next-line jsx-a11y/no-noninteractive-element-to-interactive-role
      role="button"
      tabIndex={0}
      onClick={() => setIsDropdownShown(false)}
    >
      {item}
    </li>
  ));

  // style="position: absolute; transform: translate3d(-47.0333px, 30px, 0px); top: 0px; left: 0px; will-change: transform;"

  return (
    <div className="btn-group dropdown">
      <button
        className={`${type} btn dropdown-toggle toolbar-item-spacing`}
        type="button"
        onClick={() => setIsDropdownShown(!isDropdownShown)}
      >
        {titleContent}
        <i
          className={`${isDropdownShown ? 'icons-arrow-up' : 'icons-arrow-down'} d-none d-xl-block`}
          aria-hidden="true"
        />
      </button>
      <div
        className={`dropdown-menu dropdown-menu-right ${isDropdownShown ? 'show' : null}`}
        style={{
          position: 'absolute',
          'will-change': 'transform',
          top: '0px',
          left: '0px',
          transform: 'translate3d(-67px, 45px, 0px)',
          zIndex: 1000,
        }}
        // eslint-disable-next-line react/no-unknown-property
        x-placement="bottom-end"
      >
        <ul>{itemNode}</ul>
      </div>
      {isDropdownShown && (
        <div
          style={{
            position: 'fixed',
            top: '0',
            left: '0',
            width: '100vw',
            height: '100vh',
            zIndex: 999,
          }}
          role="button"
          tabIndex={0}
          onClick={() => setIsDropdownShown(false)}
        >
          &nbsp;
        </div>
      )}
    </div>
  );
}

DropdownSNCF.propTypes = {
  titleContent: PropTypes.oneOfType([PropTypes.string, PropTypes.object]).isRequired,
  items: PropTypes.arrayOf(PropTypes.node).isRequired,
  type: PropTypes.oneOf(Object.values(DROPDOWN_STYLE_TYPES)).isRequired,
};

export default DropdownSNCF;
