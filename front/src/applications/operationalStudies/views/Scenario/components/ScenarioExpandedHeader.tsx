import { type ReactNode, useState } from 'react';

import { Select } from '@osrd-project/ui-core';
import { ArrowRight, ChevronUp, Dot, Pencil, Plus, Trash } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { sortBy, uniqueId } from 'lodash';
import { useTranslation } from 'react-i18next';

import { useScenarioContextWithOptionalTimetable } from 'applications/operationalStudies/hooks/useScenarioContext';
import useUrlOrStorageParam from 'applications/operationalStudies/hooks/useUrlOrStorageParam';
import {
  osrdEditoastApi,
  type ScenarioPatchForm,
  type TimetableSummary,
  type TimetableType,
} from 'common/api/osrdEditoastApi';
import { useModal } from 'common/BootstrapSNCF/ModalSNCF';
import DeleteItemsModal from 'modules/project/components/DeleteItemsModal';
import { type ScenarioField } from 'modules/scenario/components/AddOrEditScenarioModal';
import { cleanScenarioLocalStorage } from 'modules/scenario/helpers/utils';
import { setFailure, setSuccess } from 'reducers/main';
import { useAppDispatch } from 'store';
import { castErrorToFailure } from 'utils/error';

import InfraLoadingState from './InfraLoadingState';

type ScenarioExpandedHeaderProps = {
  onEditScenario: (field: ScenarioField) => void;
  onAddTimetable: (type: TimetableType) => void;
  onEditTimetable: (timetable: TimetableSummary) => void;
  onCollapse: () => void;
};

type DetailsSectionProps = {
  title: string;
  icons?: ReactNode;
  children: ReactNode;
};

const DetailsSection = ({ title, icons, children }: DetailsSectionProps) => (
  <section className="details-section">
    <div className="details-section-header">
      <h2 className="details-section-title" title={title}>
        {title}
      </h2>
      {icons && <div className="details-section-icons">{icons}</div>}
    </div>
    {children}
  </section>
);

const TIMETABLE_TYPES: TimetableType[] = ['HOURLY', 'CALENDAR'];

const ScenarioExpandedHeader = ({
  onEditScenario,
  onAddTimetable,
  onEditTimetable,
  onCollapse,
}: ScenarioExpandedHeaderProps) => {
  'use memo';

  const { t } = useTranslation('operational-studies');
  const dispatch = useAppDispatch();
  const { scenario, timetableId, workerStatus } = useScenarioContextWithOptionalTimetable();
  const { setParamsInUrlAndStorage } = useUrlOrStorageParam('timetable');
  const { openModal } = useModal();

  const [patchScenario, { isLoading: isPatchingScenario }] =
    osrdEditoastApi.endpoints.patchScenariosByScenarioId.useMutation();
  const [deleteTimetable] = osrdEditoastApi.endpoints.deleteTimetableById.useMutation();

  // Used to remount the selects when the update fails.
  const [selectsKey, setSelectsKey] = useState(() => uniqueId());

  const { infraOptions = [] } = osrdEditoastApi.endpoints.getInfra.useQuery(
    { pageSize: 1000 },
    {
      selectFromResult: ({ data }) => ({
        infraOptions: data?.results.map(({ id, name }) => ({ id, name })),
      }),
    }
  );
  // Fallback on the scenario infra so that the select is never empty while loading the list
  const infraSelectOptions =
    infraOptions.length > 0 ? infraOptions : [{ id: scenario.infra_id, name: scenario.infra_name }];

  const { electricalProfileSetOptions = [] } =
    osrdEditoastApi.endpoints.getElectricalProfileSet.useQuery(undefined, {
      selectFromResult: ({ data }) => ({
        electricalProfileSetOptions: [
          { id: undefined, name: t('main.noElectricalProfileSet') },
          ...sortBy(data, ['name']),
        ],
      }),
    });

  // The timetable name is optional, so we use its type as a fallback label
  const timetables = scenario.timetable_summaries.map(({ id, type, name }) => ({
    id,
    type,
    name,
    label:
      name ??
      (type === 'HOURLY'
        ? t('main.scenarioTimetableTypeHourly')
        : t('main.scenarioTimetableTypeCalendar')),
  }));

  const updateScenario = (scenarioPatchForm: ScenarioPatchForm) => {
    patchScenario({ scenarioId: scenario.id, scenarioPatchForm })
      .unwrap()
      .then(() => {
        dispatch(
          setSuccess({
            title: t('main.scenarioUpdated'),
            text: t('main.scenarioUpdatedDetails', { name: scenario.name }),
          })
        );
      })
      .catch((error) => {
        setSelectsKey(uniqueId());
        dispatch(setFailure(castErrorToFailure(error)));
      });
  };

  const removeTimetable = (timetable: TimetableSummary) => {
    deleteTimetable({ id: timetable.id })
      .unwrap()
      .then(() => cleanScenarioLocalStorage({ timetable_summaries: [timetable] }))
      .catch((error) => dispatch(setFailure(castErrorToFailure(error))));
  };

  const openDeleteTimetableModal = (timetable: TimetableSummary, label: string) => {
    openModal(
      <DeleteItemsModal
        translationKey={t('main.scenarioTimetableConfirmDelete', { name: label })}
        handleDeleteItems={() => removeTimetable(timetable)}
      />,
      'sm',
      'scenario-delete-timetable-modal'
    );
  };

  const getEditButton = (field: ScenarioField) => (
    <button
      type="button"
      aria-label={t('main.editScenario')}
      title={t('main.editScenario')}
      onClick={() => onEditScenario(field)}
    >
      <Pencil />
    </button>
  );

  return (
    <div className="scenario-expanded-header">
      <div className="scenario-expanded-header-grid">
        <DetailsSection title={t('main.scenarioName')} icons={getEditButton('name')}>
          <p className="details-section-text">{scenario.name}</p>
        </DetailsSection>

        <DetailsSection title={t('main.scenarioDescription')} icons={getEditButton('description')}>
          <p className={cx('details-section-text', { empty: !scenario.description })}>
            {scenario.description || t('main.scenarioNoDescription')}
          </p>
        </DetailsSection>

        <DetailsSection
          title={t('main.scenarioInfrastructureLabel')}
          icons={
            workerStatus === 'READY' ? (
              <Dot variant="fill" className="infra-ready" title={workerStatus} />
            ) : (
              <InfraLoadingState />
            )
          }
        >
          <Select
            key={selectsKey}
            id="scenario-expanded-header-infra"
            small
            narrow
            value={infraSelectOptions.find((infra) => infra.id === scenario.infra_id)}
            options={infraSelectOptions}
            getOptionValue={(infra) => String(infra.id)}
            getOptionLabel={(infra) => `${infra.name} | ID${infra.id}`}
            onChange={(infra) => {
              if (infra && infra.id !== scenario.infra_id) updateScenario({ infra_id: infra.id });
            }}
            disabled={isPatchingScenario}
          />
        </DetailsSection>

        <DetailsSection title={t('main.scenarioTags')} icons={getEditButton('tags')}>
          {scenario.tags.length > 0 ? (
            <ul className="details-section-tags">
              {scenario.tags.map((tag, index) => (
                <li key={`${tag}-${index}`} className="details-section-tag">
                  {tag}
                </li>
              ))}
            </ul>
          ) : (
            <p className="details-section-text empty">{t('main.scenarioNoTags')}</p>
          )}
        </DetailsSection>

        {TIMETABLE_TYPES.map((type) => {
          const sectionTimetables = timetables.filter((timetable) => timetable.type === type);
          return (
            <DetailsSection
              key={type}
              title={t(`main.scenarioTimetableSections.${type}.title`)}
              icons={
                <button
                  type="button"
                  aria-label={t('translation:common.add')}
                  title={t('translation:common.add')}
                  onClick={() => onAddTimetable(type)}
                >
                  <Plus />
                </button>
              }
            >
              {sectionTimetables.length > 0 ? (
                <ul className="details-section-timetables">
                  {sectionTimetables.map(({ id, name, label }) => {
                    const isSelected = id === timetableId;
                    return (
                      <li
                        key={id}
                        className={cx('details-section-timetable', { selected: isSelected })}
                      >
                        {isSelected ? <ArrowRight /> : <Dot />}
                        <button
                          type="button"
                          className="details-section-timetable-label"
                          title={label}
                          onClick={() => setParamsInUrlAndStorage('timetable', String(id))}
                        >
                          {label}
                        </button>
                        <div className="details-section-timetable-icons">
                          <button
                            type="button"
                            aria-label={t('translation:common.delete')}
                            title={t('translation:common.delete')}
                            onClick={() => openDeleteTimetableModal({ id, type, name }, label)}
                          >
                            <Trash />
                          </button>
                          <button
                            type="button"
                            aria-label={t('translation:common.edit')}
                            title={t('translation:common.edit')}
                            onClick={() => onEditTimetable({ id, type, name })}
                          >
                            <Pencil />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="details-section-text empty">
                  {t(`main.scenarioTimetableSections.${type}.empty`)}
                </p>
              )}
            </DetailsSection>
          );
        })}

        <DetailsSection title={t('main.scenarioElectricalProfile')}>
          <Select
            key={selectsKey}
            id="scenario-expanded-header-electrical-profile-set"
            small
            narrow
            value={electricalProfileSetOptions.find(
              (profile) => profile.id === (scenario.electrical_profile_set_id ?? undefined)
            )}
            options={electricalProfileSetOptions}
            getOptionValue={(profile) => String(profile.id ?? '')}
            getOptionLabel={(profile) => profile.name}
            onChange={(profile) => {
              updateScenario({ electrical_profile_set_id: profile?.id ?? null });
            }}
            disabled={isPatchingScenario}
          />
        </DetailsSection>
      </div>

      <button type="button" className="scenario-expanded-header-collapse" onClick={onCollapse}>
        {t('translation:common.collapse')}
        <ChevronUp />
      </button>
    </div>
  );
};

export default ScenarioExpandedHeader;
