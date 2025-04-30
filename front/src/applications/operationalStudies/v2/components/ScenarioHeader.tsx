import { X, ChevronDown, Question } from '@osrd-project/ui-icons';

import useAuth from 'utils/hooks/useAuth';

type ScenarioHeaderProps = {
  scenarioName: string;
};

const ScenarioHeader = ({ scenarioName }: ScenarioHeaderProps) => {
  const { username } = useAuth();

  const boards = ['Traits', 'Map', 'Macro', 'STD', 'SDD', 'Table', 'Conflicts'];

  return (
    <header className="scenario-header">
      {/* scenario info */}
      <div className="scenario-info">
        <button className="close-btn" type="button">
          <X />
        </button>

        <span className="scenario-name">{scenarioName}</span>

        <button className="chevron-btn" type="button">
          <ChevronDown />
        </button>
      </div>

      {/* board display management */}
      <nav className="board-bar">
        {boards.map((board) => (
          <button key={board} className="board-btn" type="button">
            {board}
          </button>
        ))}
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
