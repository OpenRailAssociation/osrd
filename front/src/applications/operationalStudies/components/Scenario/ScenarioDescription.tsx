import { useEffect, useMemo, useRef, useState } from 'react';

import { Blocked, ChevronLeft, Pencil, X } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';

import {
  osrdEditoastApi,
  type InfraWithState,
  type ScenarioResponse,
} from 'common/api/osrdEditoastApi';
import { useModal } from 'common/BootstrapSNCF/ModalSNCF';
import AddAndEditScenarioModal from 'modules/scenario/components/AddOrEditScenarioModal';
import useOutsideClick from 'utils/hooks/useOutsideClick';

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
  const [isOpenedDescription, setIsOpenedDescription] = useState<boolean>(false);
  const expandedDescriptionRef = useRef<HTMLDivElement | null>(null);
  const collapsedDescriptionRef = useRef<HTMLDivElement | null>(null);
  const [isTooLongDescription, setIsTooLongDescription] = useState<boolean>(false);

  const { data: electricalProfileSets } =
    osrdEditoastApi.endpoints.getElectricalProfileSet.useQuery();

  const electricalProfileSet = useMemo(
    () =>
      electricalProfileSets?.find((profile) => profile.id === scenario.electrical_profile_set_id),
    [electricalProfileSets]
  );

  const toggleDescription = () => {
    setIsOpenedDescription(!isOpenedDescription);
  };

  const checkIfDescriptionIsTooLong = () => {
    if (collapsedDescriptionRef.current)
      setIsTooLongDescription(
        collapsedDescriptionRef.current.scrollHeight > collapsedDescriptionRef.current.clientHeight
      );
  };

  useOutsideClick(expandedDescriptionRef, () => setIsOpenedDescription(false));

  useEffect(() => {
    checkIfDescriptionIsTooLong();
    window.addEventListener('resize', checkIfDescriptionIsTooLong);

    return () => {
      window.removeEventListener('resize', checkIfDescriptionIsTooLong);
    };
  }, []);

  useEffect(checkIfDescriptionIsTooLong, [scenario.description]);

  return (
    <div>
      <div className="scenario-details-name">
        <span className="flex-grow-1 scenario-name text-truncate" title={scenario.name}>
          {scenario.name}
        </span>
      </div>
      <div className="scenario-description">
        {scenario.description && (
          <div ref={collapsedDescriptionRef} className="scenario-details-description not-opened">
            {scenario.description}
            {isTooLongDescription && (
              <span role="button" onClick={toggleDescription} tabIndex={0}>
                (plus)
              </span>
            )}
          </div>
        )}
        {isOpenedDescription && (
          <div ref={expandedDescriptionRef} className="scenario-details-description opened">
            {scenario.description}
            <span
              onClick={toggleDescription}
              role="button"
              tabIndex={0}
              className="displayed-description"
            >
              <X />
            </span>
          </div>
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
          data-testid="edit-scenario"
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
        {scenario.electrical_profile_set_id ? (
          <span>
            {electricalProfileSet?.name
              ? t('description.electricalProfileWithName', {
                  name: electricalProfileSet.name,
                  id: scenario.electrical_profile_set_id,
                })
              : t('description.electricalProfileWithId', {
                  id: scenario.electrical_profile_set_id,
                })}
          </span>
        ) : (
          t('noElectricalProfileSet')
        )}
      </div>
      {infra && infra.state === 'INITIALIZING' && (
        <div className="infra-banner">{t('infraBrokenBanner', "L'infrastructure est cassée")}</div>
      )}
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
