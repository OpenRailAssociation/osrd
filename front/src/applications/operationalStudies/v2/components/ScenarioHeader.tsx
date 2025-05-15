import { Fragment, useCallback, useEffect, useRef, useState } from 'react';

import { X, ChevronDown } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';

import useAuth from 'utils/hooks/useAuth';

type ScenarioHeaderProps = {
  scenarioName: string;
};

const ScenarioHeader = ({ scenarioName }: ScenarioHeaderProps) => {
  const { username } = useAuth();
  const { t } = useTranslation('common');
  const [activeBoards, setActiveBoards] = useState<string[]>([]);
  const [isTruncated, setIsTruncated] = useState({
    scenarioName: false,
    username: false,
  });

  const scenarioNameRef = useRef<HTMLSpanElement>(null);
  const usernameRef = useRef<HTMLButtonElement>(null);

  const boards = ['Traits', 'Map', 'Macro', 'STD', 'SDD', 'Table', 'Conflicts'];

  const toggleBoard = (selectedBoard: string) => {
    setActiveBoards((prevBoards) => {
      if (prevBoards.includes(selectedBoard)) {
        return prevBoards.filter((b) => b !== selectedBoard);
      }
      return [...prevBoards, selectedBoard];
    });
  };

  useEffect(() => {
    const checkTruncation = () => {
      setIsTruncated((prev) => ({
        scenarioName: scenarioNameRef.current
          ? scenarioNameRef.current.scrollWidth > scenarioNameRef.current.clientWidth
          : prev.scenarioName,
        username: usernameRef.current
          ? usernameRef.current.scrollWidth > usernameRef.current.clientWidth
          : prev.username,
      }));
    };
    checkTruncation();
    window.addEventListener('resize', checkTruncation);
    return () => {
      window.removeEventListener('resize', checkTruncation);
    };
  }, []);

  return (
    <header className="scenario-header">
      {/* scenario info */}
      <div className="scenario-info">
        <button className="close-btn" type="button">
          <X />
        </button>

        <div className="inactive-area" />

        <span className="close-label">{t('close')}</span>

        <div className="scenario-name-container">
          <span
            ref={scenarioNameRef}
            className={cx('scenario-name-label', { 'is-truncated': isTruncated.scenarioName })}
          >
            {scenarioName}
          </span>

          <div className="chevron-container">
            <button className="chevron-btn" type="button">
              <ChevronDown />
            </button>

            <div className="spacer" />
          </div>
        </div>
      </div>

      {/* board display management */}
      <nav className="board-bar">
        <div className="spacer" />

        <div className="board-btns">
          {boards.map((board, index) => (
            <Fragment key={board}>
              <button
                className={cx('board-btn', {
                  on: activeBoards.includes(board),
                })}
                type="button"
                onClick={() => {
                  toggleBoard(board);
                }}
              >
                {board}
              </button>
              {index < boards.length - 1 && <div className="inactive-area" />}
            </Fragment>
          ))}
        </div>

        <div className="spacer" />
      </nav>

      {/* user informations */}
      <div className="user-info">
        <div className="spacer" />

        <button
          ref={usernameRef}
          className={cx('user-name', { 'is-truncated': isTruncated.username })}
          type="button"
        >
          {username}
        </button>
      </div>
    </header>
  );
};

export default ScenarioHeader;
