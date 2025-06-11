import { Fragment, useEffect, useRef, useState } from 'react';

import { X, ChevronDown, ChevronUp } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import InfraLoadingState from 'applications/operationalStudies/components/Scenario/InfraLoadingState';
import type { InfraWithState, ScenarioResponse } from 'common/api/osrdEditoastApi';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { useModal } from 'common/BootstrapSNCF/ModalSNCF';
import UserActionsDropdown from 'common/UserActionsDropdown';
import AddAndEditScenarioModal from 'modules/scenario/components/AddOrEditScenarioModal';
import useAuth from 'utils/hooks/useAuth';

type ScenarioHeaderProps = {
  scenario: ScenarioResponse;
  infra: InfraWithState;
  toggleTimeTable: () => void;
  toggleConflictsList: () => void;
};

const ScenarioHeader = ({
  scenario,
  infra,
  toggleConflictsList,
  toggleTimeTable,
}: ScenarioHeaderProps) => {
  const { username } = useAuth();
  const { openModal } = useModal();
  const navigate = useNavigate();

  const { t } = useTranslation(['translation', 'operational-studies']);
  const [activeBoards, setActiveBoards] = useState<string[]>([
    'Trains',
    'Map',
    'Macro',
    'STD',
    'SDD',
    'Table',
    'Conflicts',
  ]);
  const [isTruncated, setIsTruncated] = useState({
    scenarioName: false,
    username: false,
  });
  const [areScenarioDetailsVisible, setAreScenarioDetailsVisible] = useState(false);

  const scenarioNameRef = useRef<HTMLSpanElement>(null);
  const usernameRef = useRef<HTMLSpanElement>(null);

  const boards = ['Trains', 'Map', 'Macro', 'STD', 'SDD', 'Table', 'Conflicts'];

  const { electricalProfileSet } = osrdEditoastApi.endpoints.getElectricalProfileSet.useQuery(
    undefined,
    {
      selectFromResult: (response) => ({
        ...response,
        electricalProfileSet: response.data?.find(
          (profile) => profile.id === scenario.electrical_profile_set_id
        ),
      }),
    }
  );

  const toggleBoard = (selectedBoard: string) => {
    setActiveBoards((prevBoards) => {
      if (prevBoards.includes(selectedBoard)) {
        return prevBoards.filter((b) => b !== selectedBoard);
      }
      return [...prevBoards, selectedBoard];
    });
  };

  const toggleScenarioDetails = () => {
    setAreScenarioDetailsVisible((prev) => !prev);
  };

  const closeScenario = () => {
    navigate(`/operational-studies/projects/${scenario.project.id}/studies/${scenario.study.id}`);
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

  const userDropdownTitle = (
    <span ref={usernameRef} className={cx('user-name', { 'is-truncated': isTruncated.username })}>
      {username}
    </span>
  );

  return (
    <header className="scenario-header-container">
      <div className="scenario-header">
        {/* scenario info */}
        <div className="scenario-info">
          <button className="close-btn" type="button" onClick={closeScenario}>
            <X />
          </button>

          <div className="inactive-area" />

          <span className="close-label">{t('translation:common.close')}</span>

          <div
            className="scenario-name-container"
            role="button"
            tabIndex={0}
            onClick={toggleScenarioDetails}
          >
            <span
              ref={scenarioNameRef}
              className={cx('scenario-name-label', { 'is-truncated': isTruncated.scenarioName })}
            >
              {scenario.name}
            </span>

            <button className="chevron-btn" type="button">
              {areScenarioDetailsVisible ? <ChevronUp /> : <ChevronDown />}
            </button>
          </div>

          <div className="spacer" />
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
                    if (board === 'Conflicts') {
                      toggleConflictsList();
                    } else if (board === 'Trains') {
                      toggleTimeTable();
                    }
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
          <UserActionsDropdown className="dropdwon-position" titleContent={userDropdownTitle} />
        </div>
      </div>

      {/* scenario details */}
      {areScenarioDetailsVisible && (
        <div className="scenario-details">
          <span className="scenario-description"> {scenario.description} </span>

          <div className="scenario-details-infra-name">
            {t('main.infrastructure')} :&nbsp;
            {infra && <InfraLoadingState infra={infra} />}
            &nbsp;
            <span className="scenario-infra-name">{scenario.infra_name}</span>&nbsp;| ID
            {scenario.infra_id}
          </div>

          <div className="scenario-details-electrical-profile-set">
            {scenario.electrical_profile_set_id ? (
              <span>
                {electricalProfileSet?.name
                  ? t('main.description.electricalProfileWithName', {
                      name: electricalProfileSet.name,
                      id: scenario.electrical_profile_set_id,
                    })
                  : t('main.description.electricalProfileWithId', {
                      id: scenario.electrical_profile_set_id,
                    })}
              </span>
            ) : (
              t('main.noElectricalProfileSet')
            )}
          </div>

          <div className="edit-scenario-container">
            <button
              className="edit-scenario"
              type="button"
              aria-label={t('main.editScenario')}
              onClick={() =>
                openModal(
                  <AddAndEditScenarioModal editionMode scenario={scenario} />,
                  'xl',
                  'no-close-modal'
                )
              }
              title={t('main.editScenario')}
            >
              {t('translation:common.edit')}
            </button>
          </div>
        </div>
      )}
    </header>
  );
};

export default ScenarioHeader;
