import { Blocked, ChevronLeft, Pencil } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';

import type { InfraWithState, ScenarioResponse } from 'common/api/osrdEditoastApi';
import { useModal } from 'common/BootstrapSNCF/ModalSNCF';
import AddAndEditScenarioModal from 'modules/scenario/components/AddOrEditScenarioModal';

import InfraLoadingState from './InfraLoadingState';

type ScenarioDescriptionProps = {
  scenario: ScenarioResponse;
  infra?: InfraWithState;
  infraReloadCount: number;
  collapseTimetable: () => void;
};

const ScenarioDescription = ({
  scenario,
  infra,
  infraReloadCount,
  collapseTimetable,
}: ScenarioDescriptionProps) => {
  const { t } = useTranslation('operationalStudies/scenario');
  const { openModal } = useModal();

  return (
    <div>
      <div className="scenario-details-name">
        <span className="flex-grow-1 scenario-name text-truncate" title={scenario.name}>
          {scenario.name}
        </span>
      </div>

      <div className="scenario-description">
        {scenario.description && (
          <div className="scenario-details-description">{scenario.description}</div>
        )}
        <div className="flex justify-end">
          <button
            data-testid="scenario-collapse-button"
            type="button"
            className="scenario-collapse-button"
            aria-label={t('toggleTimetable')}
            onClick={() => collapseTimetable()}
          >
            <ChevronLeft />
          </button>
        </div>
        <button
          data-testid="editScenario"
          className="update-scenario"
          type="button"
          aria-label={t('editScenario')}
          onClick={() =>
            openModal(
              <AddAndEditScenarioModal editionMode scenario={scenario} />,
              'xl',
              'no-close-modal'
            )
          }
          title={t('editScenario')}
        >
          <Pencil />
        </button>
      </div>
      <div className="scenario-details-electrical-profile-set">
        {scenario.electrical_profile_set_id
          ? scenario.electrical_profile_set_id
          : t('noElectricalProfileSet')}
      </div>

      <div className="scenario-details-infra-name">
        {t('infrastructure')} :&nbsp;
        {infra && <InfraLoadingState infra={infra} />}
        &nbsp;
        <span className="scenario-infra-name">{scenario.infra_name}</span>&nbsp;| ID
        {scenario.infra_id}
      </div>
      {infra &&
        infra.state === 'TRANSIENT_ERROR' &&
        (infraReloadCount <= 5 ? (
          <div className="scenario-details-infra-error">
            <Blocked variant="fill" />
            <span className="error-description">
              {t('errorMessages.unableToLoadInfra', { infraReloadCount })}
            </span>
          </div>
        ) : (
          <div className="scenario-details-infra-error">
            <Blocked variant="fill" />
            <span className="error-description">{t('errorMessages.softErrorInfra')}</span>
          </div>
        ))}
      {infra && infra.state === 'ERROR' && (
        <div className="scenario-details-infra-error">
          <Blocked variant="fill" />
          <span className="error-description">{t('errorMessages.hardErrorInfra')}</span>
        </div>
      )}
    </div>
  );
};

export default ScenarioDescription;
