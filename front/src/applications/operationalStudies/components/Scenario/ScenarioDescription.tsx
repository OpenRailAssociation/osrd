import { ChevronLeft, Eye, EyeClosed, Pencil } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';
import { GiElectric } from 'react-icons/gi';

import InfraLoadingState from 'applications/operationalStudies/components/Scenario/InfraLoadingState';
import infraLogo from 'assets/pictures/components/tracks.svg';
import type { InfraWithState, ScenarioResponse } from 'common/api/osrdEditoastApi';
import { useModal } from 'common/BootstrapSNCF/ModalSNCF';
import AddAndEditScenarioModal from 'modules/scenario/components/AddOrEditScenarioModal';

type ScenarioDescriptionProps = {
  scenario: ScenarioResponse;
  infra?: InfraWithState;
  infraReloadCount: number;
  showTrainDetails: boolean;
  toggleTrainDetails: () => void;
  collapseTimetable: () => void;
};

const ScenarioDescription = ({
  scenario,
  infra,
  infraReloadCount,
  showTrainDetails,
  toggleTrainDetails,
  collapseTimetable,
}: ScenarioDescriptionProps) => {
  const { t } = useTranslation('operationalStudies/scenario');
  const { openModal } = useModal();

  return (
    <div className="scenario-details">
      <div className="scenario-details-name">
        <span className="flex-grow-1 scenario-name text-truncate" title={scenario.name}>
          {scenario.name}
        </span>
        <button
          data-testid="editScenario"
          className="scenario-details-modify-button"
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
        <button
          type="button"
          className="scenario-details-modify-button"
          onClick={toggleTrainDetails}
          title={t('displayTrainsWithDetails')}
        >
          {showTrainDetails ? <EyeClosed /> : <Eye />}
        </button>
        <button
          type="button"
          className="scenario-details-modify-button"
          aria-label={t('toggleTimetable')}
          onClick={() => collapseTimetable()}
        >
          <ChevronLeft />
        </button>
      </div>
      <div className="row">
        <div className="col-md-6">
          <div className="scenario-details-infra-name">
            <img src={infraLogo} alt="Infra logo" className="infra-logo mr-2" />
            {infra && <InfraLoadingState infra={infra} />}
            <span className="scenario-infra-name">{scenario.infra_name}</span>
            <small className="ml-auto text-muted">ID {scenario.infra_id}</small>
          </div>
        </div>
        <div className="col-md-6">
          <div className="scenario-details-electrical-profile-set">
            <span className="mr-2">
              <GiElectric />
            </span>
            {scenario.electrical_profile_set_id
              ? scenario.electrical_profile_set_id
              : t('noElectricalProfileSet')}
          </div>
        </div>
      </div>
      {infra &&
        infra.state === 'TRANSIENT_ERROR' &&
        (infraReloadCount <= 5 ? (
          <div className="scenario-details-infra-error mt-1">
            {t('errorMessages.unableToLoadInfra', { infraReloadCount })}
          </div>
        ) : (
          <div className="scenario-details-infra-error mt-1">
            {t('errorMessages.softErrorInfra')}
          </div>
        ))}
      {infra && infra.state === 'ERROR' && (
        <div className="scenario-details-infra-error mt-1">{t('errorMessages.hardErrorInfra')}</div>
      )}
      <div className="scenario-details-description">{scenario.description}</div>
    </div>
  );
};

export default ScenarioDescription;
