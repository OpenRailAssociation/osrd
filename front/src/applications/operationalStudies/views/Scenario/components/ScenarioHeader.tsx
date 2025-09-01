import { Fragment, useEffect, useRef, useState } from 'react';

import { X, ChevronDown, ChevronUp, Hubot, SignOut } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { useScenarioContext } from 'applications/operationalStudies/hooks/useScenarioContext';
import type { Board } from 'applications/operationalStudies/types';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { useModal } from 'common/BootstrapSNCF/ModalSNCF';
import UserActionsDropdown from 'common/NavBar/UserActionsDropdown';
import AddAndEditScenarioModal from 'modules/scenario/components/AddOrEditScenarioModal';
import useAuth from 'utils/hooks/useAuth';

import InfraLoadingState from './InfraLoadingState';

const BOARDS: Board[] = ['trains', 'map', 'macro', 'std', 'sdd', 'tables', 'conflicts'];

type ScenarioHeaderProps = {
  activeBoards: Set<Board>;
  toggleBoard: (board: Board) => void;
};

const ScenarioHeader = ({ activeBoards, toggleBoard }: ScenarioHeaderProps) => {
  const { username, impersonatedUser, impersonate } = useAuth();
  const { openModal } = useModal();
  const navigate = useNavigate();
  const { scenario } = useScenarioContext();
  const { t } = useTranslation('operational-studies');

  const [isTruncated, setIsTruncated] = useState({
    scenarioName: false,
    username: false,
  });
  const [areScenarioDetailsVisible, setAreScenarioDetailsVisible] = useState(false);

  const scenarioNameRef = useRef<HTMLSpanElement>(null);
  const usernameRef = useRef<HTMLSpanElement>(null);

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
      <div className={cx('scenario-header', { impersonated: impersonatedUser })}>
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
            data-testid="scenario-name-container"
          >
            <span
              ref={scenarioNameRef}
              className={cx('scenario-name-label', { 'is-truncated': isTruncated.scenarioName })}
              data-testid="scenario-name-label"
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
            {BOARDS.map((board, index) => (
              <Fragment key={board}>
                <button
                  className={cx('board-btn', {
                    on: activeBoards.has(board),
                  })}
                  type="button"
                  data-testid={`${board}-button`}
                  onClick={() => {
                    toggleBoard(board);
                  }}
                >
                  {t(`boards.${board}`)}
                </button>
                {index < BOARDS.length - 1 && <div className="inactive-area" />}
              </Fragment>
            ))}
          </div>

          <div className="spacer" />
        </nav>

        {/* user informations */}
        <div className="user-info">
          <div className="spacer" />
          {impersonatedUser && <Hubot size="lg" className="mr-2 text-black" />}
          <UserActionsDropdown className="dropdwon-position" titleContent={userDropdownTitle} />
          {impersonatedUser && (
            <button type="button" onClick={() => impersonate(undefined)}>
              <SignOut className="ml-3 text-black" />
            </button>
          )}
        </div>
      </div>

      {/* scenario details */}
      {areScenarioDetailsVisible && (
        <div className="scenario-details">
          <span className="scenario-description" data-testid="scenario-details-description">
            {scenario.description}
          </span>

          <div className="scenario-details-infra-name">
            {t('main.infrastructure')} :&nbsp;
            <InfraLoadingState />
            &nbsp;
            <span className="scenario-infra-name" data-testid="scenario-infra-name">
              {scenario.infra_name}
            </span>
            &nbsp;| ID
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
              data-testid="edit-scenario"
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
