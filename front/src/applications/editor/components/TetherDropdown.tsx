import React, { FC, LegacyRef, ReactNode, useEffect, useRef, useState } from 'react';
import nextId from 'react-id-generator';
import TetherComponent from 'react-tether';

/**
 * This component is a shameless clone of DropdownSNCF, but using Tether to
 * portal out of eventual overflown containers:
 */
const TetherDropdown: FC<{
  titleContent: string | JSX.Element;
  items?: ReactNode[];
  type: string;
}> = ({ titleContent, items = [], type }) => {
  const [isDropdownShown, setIsDropdownShown] = useState(false);
  const targetRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    const handleClickBody = (e: MouseEvent) => {
      if (isDropdownShown && targetRef.current && !targetRef.current.contains(e.target as Node)) {
        setIsDropdownShown(false);
      }
    };

    setTimeout(() => document.body.addEventListener('click', handleClickBody), 0);
    return () => document.body.removeEventListener('click', handleClickBody);
  }, [isDropdownShown]);

  return (
    <div className="btn-group dropdown">
      <TetherComponent
        className="over-modal shadow z-index-tooltip"
        attachment="top right"
        targetAttachment="bottom right"
        renderTarget={(ref) => (
          <button
            ref={ref as LegacyRef<HTMLButtonElement>}
            className={`${type} btn dropdown-toggle toolbar-item-spacing`}
            type="button"
            onClick={() => !isDropdownShown && setIsDropdownShown(true)}
          >
            {titleContent}
            <i
              className={`${
                isDropdownShown ? 'icons-arrow-up' : 'icons-arrow-down'
              } d-none d-xl-block`}
              aria-hidden="true"
            />
          </button>
        )}
        renderElement={(ref) =>
          isDropdownShown && (
            <div ref={ref as LegacyRef<HTMLDivElement>}>
              <div
                ref={targetRef}
                className="dropdown-menu dropdown-menu-right show d-block position-static"
              >
                <ul>{itemNode}</ul>
              </div>
            </div>
          )
        }
      />
    </div>
  );
};

export default TetherDropdown;
