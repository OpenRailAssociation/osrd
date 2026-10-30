import { type ReactNode } from 'react';

import { Select } from '@osrd-project/ui-core';
import { ArrowRight, ChevronUp, Dot, Pencil, Plus, Trash } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { sortBy } from 'lodash';
import { useTranslation } from 'react-i18next';

import { useScenarioContext } from 'applications/operationalStudies/hooks/useScenarioContext';
import {
  osrdEditoastApi,
  type ScenarioPatchForm,
  type TimetableType,
} from 'common/api/osrdEditoastApi';
import { type ScenarioField } from 'modules/scenario/components/AddOrEditScenarioModal';
import { setFailure, setSuccess } from 'reducers/main';
import { useAppDispatch } from 'store';
import { castErrorToFailure } from 'utils/error';

import InfraLoadingState from './InfraLoadingState';

type ScenarioExpandedHeaderProps = {
  onEditScenario: (field: ScenarioField) => void;
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

const ScenarioExpandedHeader = ({ onEditScenario, onCollapse }: ScenarioExpandedHeaderProps) => {
  'use memo';

  const { t } = useTranslation('operational-studies');
  const dispatch = useAppDispatch();
  const { scenario, timetableId, workerStatus } = useScenarioContext();

  const [patchScenario, { isLoading: isPatchingScenario }] =
    osrdEditoastApi.endpoints.patchScenariosByScenarioId.useMutation();

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

  // TODO(#18904): list every timetable of the scenario once the backend handles several ones
  // The timetable name is not available yet, so we temporarily use its type as label
  const timetables = [
    {
      id: timetableId,
      type: scenario.timetable_type,
      label:
        scenario.timetable_type === 'HOURLY'
          ? t('main.scenarioTimetableTypeHourly')
          : t('main.scenarioTimetableTypeCalendar'),
    },
  ];

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
        dispatch(setFailure(castErrorToFailure(error)));
      });
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
                // TODO: no action until #19081 is merged
                <button
                  type="button"
                  aria-label={t('translation:common.add')}
                  title={t('translation:common.add')}
                >
                  <Plus />
                </button>
              }
            >
              {sectionTimetables.length > 0 ? (
                <ul className="details-section-timetables">
                  {sectionTimetables.map(({ id, label }) => {
                    const isSelected = id === timetableId;
                    return (
                      <li
                        key={id}
                        className={cx('details-section-timetable', { selected: isSelected })}
                      >
                        {isSelected ? <ArrowRight /> : <Dot />}
                        <span className="details-section-timetable-label" title={label}>
                          {label}
                        </span>
                        {/* TODO(#18904): no action until the backend handles several timetables */}
                        <div className="details-section-timetable-icons">
                          <button
                            type="button"
                            aria-label={t('main.timetable.trainScheduleSets.removeFromScenario')}
                            title={t('main.timetable.trainScheduleSets.removeFromScenario')}
                          >
                            <Trash />
                          </button>
                          <button
                            type="button"
                            aria-label={t('translation:common.edit')}
                            title={t('translation:common.edit')}
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
