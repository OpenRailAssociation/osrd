import { Fragment, useState } from 'react';

import { X, ChevronDown, Question } from '@osrd-project/ui-icons';
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

  const boards = ['Traits', 'Map', 'Macro', 'STD', 'SDD', 'Table', 'Conflicts'];

  const toggleBoard = (selectedBoard: string) => {
    setActiveBoards((prevBoards) => {
      if (prevBoards.includes(selectedBoard)) {
        return prevBoards.filter((b) => b !== selectedBoard);
      }
      return [...prevBoards, selectedBoard];
    });
  };

  return (
    <header className="scenario-header">
      {/* scenario info */}
      <div className="scenario-info">
        <button className="close-btn" type="button">
          <X />
        </button>

        <div className="spacer" />

        <span className="close-label">{t('close')}</span>

        <div className="scenario-name-container">
          <span className="scenario-name-label">{scenarioName}</span>
          <button className="chevron-btn" type="button">
            <ChevronDown />
          </button>
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
              {index < boards.length - 1 && <div className="board-separator" />}
            </Fragment>
          ))}
        </div>

        <div className="spacer" />
      </nav>

      {/* user informations */}
      <div className="user-info">
        <span className="user-name" title={username}>
          {username}
        </span>
        <button className="help-icon" type="button">
          <Question />
        </button>
      </div>
    </header>
  );
};

export default ScenarioHeader;
