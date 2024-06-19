import React, { type FC, type LegacyRef, type ReactNode, useEffect, useRef, useState } from 'react';

import nextId from 'react-id-generator';
import TetherComponent from 'react-tether';

export const DROPDOWN_STYLE_TYPES = {
  primary: 'btn-primary btn-sm',
  transparent: 'btn-transparent',
} as const;

const DropdownSNCF: FC<{
  titleContent: ReactNode;
  items?: ReactNode[];
  type?: string;
  className?: string;
  noArrow?: boolean;
}> = ({ titleContent, items = [], type = 'transparent', className, noArrow = false }) => {
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
        className="over-modal dropdown"
        attachment="top right"
        targetAttachment="bottom right"
        renderTarget={(ref) => (
          <button
            data-testid="dropdown-sncf"
            ref={ref as LegacyRef<HTMLButtonElement>}
            className={className || `${type} btn dropdown-toggle toolbar-item-spacing`}
            type="button"
            onClick={() => !isDropdownShown && setIsDropdownShown(true)}
          >
            {titleContent}
            {noArrow && (
              <i
                className={`${
                  isDropdownShown ? 'icons-arrow-up' : 'icons-arrow-down'
                } d-none d-xl-block`}
                aria-hidden="true"
              />
            )}
          </button>
        )}
        renderElement={(ref) =>
          isDropdownShown && (
            <div ref={ref as LegacyRef<HTMLDivElement>}>
              <div
                ref={targetRef}
                // eslint-disable-next-line react/no-unknown-property
                x-placement="bottom-end"
                className="dropdown-menu dropdown-menu-right show d-block position-static"
              >
                <ul className="dropdown-menu-list">{itemNode}</ul>
              </div>
            </div>
          )
        }
      />
    </div>
  );
};

export default DropdownSNCF;
