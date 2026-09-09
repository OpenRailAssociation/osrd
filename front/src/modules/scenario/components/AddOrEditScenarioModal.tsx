import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import {
  Button,
  ComboBox,
  Dialog,
  Input,
  RadioGroup,
  Select,
  TextArea,
  TokenInput,
  useDefaultComboBox,
} from '@osrd-project/ui-core';
import { noop, sortBy } from 'lodash';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';

import {
  osrdEditoastApi,
  type Infra,
  type ScenarioPatchForm,
  type ScenarioWithDetails,
  type TimetableType,
} from 'common/api/osrdEditoastApi';
import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import DeleteItemsModal from 'modules/project/components/DeleteItemsModal';
import { setFailure, setSuccess } from 'reducers/main';
import { getFeatureFlag } from 'reducers/user/userSelectors';
import { useAppDispatch } from 'store';
import { castErrorToFailure } from 'utils/error';
import useInputChange from 'utils/hooks/useInputChange';
import useModalOutsideClick from 'utils/hooks/useModalOutsideClick';

import { checkScenarioFields, cleanScenarioLocalStorage } from '../helpers/utils';

// TODO: use ScenarioCreateForm from osrdEditoastApi to harmonize with study and project
export type ScenarioForm = ScenarioPatchForm & {
  id?: number;
  infra_id?: number;
  electrical_profile_set_id?: number | null;
  timetable_type?: TimetableType;
};

type AddOrEditScenarioModalProps = {
  editionMode?: boolean;
  scenario?: ScenarioWithDetails;
  onCancel?: () => void;
};

type createScenarioParams = {
  projectId: string;
  studyId: string;
};

type ElectricalProfileSetType = { id: number; name: string };

const emptyScenario: ScenarioForm = {
  description: '',
  electrical_profile_set_id: NaN,
  name: '',
  tags: [],
  timetable_type: 'CALENDAR',
};

const AddOrEditScenarioModal = ({
  editionMode = false,
  scenario,
  onCancel,
}: AddOrEditScenarioModalProps) => {
  const { t } = useTranslation(['operational-studies', 'translation']);

  const { closeModal, openModal } = useContext(ModalContext);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const hourlyTimetableActivated = useSelector(getFeatureFlag('hourlyTimetables'));

  const { data: infrasList } = osrdEditoastApi.endpoints.getInfra.useQuery({ pageSize: 1000 });
  const infras = infrasList?.results ?? [];
  const {
    suggestions: infraSuggestions,
    onChange: onInfraQueryChange,
    resetSuggestions: resetInfraSuggestions,
  } = useDefaultComboBox(infras, (s) => s.name);
  const getInfraLabel = (infra: Infra) => infra.name;

  const [currentScenario, setCurrentScenario] = useState<ScenarioForm>(scenario || emptyScenario);
  const infraValue = infras.find((infra) => infra.id === currentScenario.infra_id);

  const noElectricalProfileSetOption = {
    key: undefined,
    value: t('main.noElectricalProfileSet').toString(),
  };

  const { projectId: urlProjectId, studyId: urlStudyId } = useParams() as createScenarioParams;
  const { projectId, studyId } = useMemo(
    () => ({
      projectId: !Number.isNaN(+urlProjectId) ? +urlProjectId : undefined,
      studyId: !Number.isNaN(+urlStudyId) ? +urlStudyId : undefined,
    }),
    [urlStudyId, urlProjectId]
  );

  const [postTrainScheduleSets] = osrdEditoastApi.endpoints.postTrainScheduleSets.useMutation();
  const [postTimetable] = osrdEditoastApi.endpoints.postTimetable.useMutation({});
  const [linkTrainScheduleSetToTimetable] =
    osrdEditoastApi.endpoints.postTimetableByIdTrainScheduleSets.useMutation();
  const [postScenario] = osrdEditoastApi.endpoints.postScenarios.useMutation({});
  const [patchScenario] = osrdEditoastApi.endpoints.patchScenariosByScenarioId.useMutation({});
  const [deleteScenario] = osrdEditoastApi.endpoints.deleteScenariosByScenarioId.useMutation({});

  const { electricalProfilOptions = [] } =
    osrdEditoastApi.endpoints.getElectricalProfileSet.useQuery(undefined, {
      selectFromResult: (response) => ({
        ...response,
        electricalProfilOptions: [
          noElectricalProfileSetOption,
          ...sortBy(response.data, ['name']).map((option: ElectricalProfileSetType) => ({
            key: option.id,
            value: option.name,
          })),
        ],
      }),
    });

  const [displayErrors, setDisplayErrors] = useState(false);

  const selectedValue = useMemo(() => {
    if (currentScenario.electrical_profile_set_id) {
      const element = electricalProfilOptions.find(
        (option) => option.key === currentScenario.electrical_profile_set_id
      );
      if (element) return { id: `${element.key}`, label: element.value };
    }
    return undefined;
  }, [currentScenario.electrical_profile_set_id, electricalProfilOptions]);

  const initialValuesRef = useRef<ScenarioForm | null>(null);

  const modalRef = useRef<HTMLDivElement | null>(null);

  const { setHasChanges } = useModalOutsideClick(modalRef);

  const handleScenarioInputChange = useInputChange(
    initialValuesRef,
    setCurrentScenario,
    setHasChanges
  );

  const invalidFields = checkScenarioFields(currentScenario);
  const hasErrors = Object.values(invalidFields).some((field) => field);

  const createScenario = async () => {
    if (hasErrors) {
      setDisplayErrors(true);
    } else if (projectId && studyId && currentScenario.infra_id && currentScenario.name) {
      try {
        const timetable_type = currentScenario.timetable_type || 'CALENDAR';
        // Creating a scenario requires to: create a sandbox, a timetable, link both and finally create the scenario
        const sandbox = await postTrainScheduleSets({
          trainScheduleSetForm: {
            name: null, // sandbox never has a name
            description: '',
            published: false,
            timetable_type,
          },
        }).unwrap();
        const timetable = await postTimetable({
          timetableForm: { timetable_type },
        }).unwrap();
        await linkTrainScheduleSetToTimetable({
          id: timetable.timetable_id,
          body: { train_schedule_set_ids: [sandbox.id] },
        }).unwrap();
        const newScenario = await postScenario({
          scenarioCreateForm: {
            description: currentScenario.description || '',
            infra_id: currentScenario.infra_id,
            name: currentScenario.name,
            study_id: studyId,
            tags: currentScenario.tags || [],
            timetable_id: timetable.timetable_id,
            electrical_profile_set_id: currentScenario.electrical_profile_set_id,
          },
        }).unwrap();
        navigate(
          `/operational-studies/projects/${projectId}/studies/${studyId}/scenarios/${newScenario.id}`
        );
      } catch (error) {
        dispatch(setFailure(castErrorToFailure(error)));
      }
    }
  };

  const updateScenario = () => {
    if (hasErrors) {
      setDisplayErrors(true);
    } else if (scenario) {
      patchScenario({
        scenarioId: scenario.id,
        scenarioPatchForm: {
          description: currentScenario.description,
          infra_id: currentScenario.infra_id,
          name: currentScenario.name,
          tags: currentScenario.tags,
        },
      })
        .unwrap()
        .then(() => {
          dispatch(
            setSuccess({
              title: t('main.scenarioUpdated'),
              text: t('main.scenarioUpdatedDetails', { name: currentScenario.name }),
            })
          );
          onCancel?.();
        })
        .catch((error) => {
          dispatch(setFailure(castErrorToFailure(error)));
        });
    }
  };

  const removeScenario = () => {
    if (projectId && studyId && scenario?.id) {
      return deleteScenario({ scenarioId: scenario.id })
        .unwrap()
        .then(() => {
          cleanScenarioLocalStorage(scenario.timetable_id);
          navigate(`/operational-studies/projects/${projectId}/studies/${studyId}`);
          closeModal();
          dispatch(
            setSuccess({
              title: t('main.scenarioDeleted'),
              text: t('main.scenarioDeletedDetails', { name: scenario.name }),
            })
          );
        })
        .catch((error) => {
          console.error(error);
          dispatch(
            setFailure({
              name: t('main.errorMessages.error'),
              message: t('main.errorMessages.unableToDeleteScenarioMessage'),
            })
          );
        });
    }
    return Promise.reject(
      new Error('Cannot delete scenario: missing project, study or scenario id')
    );
  };

  const openDeleteItemsModal = useCallback(() => {
    openModal(
      <DeleteItemsModal
        translationKey={t('scenario.confirm-delete', { count: 1 })}
        handleDeleteItems={() => {
          removeScenario().then(onCancel);
        }}
      />,
      'sm'
    );
  }, [onCancel, openModal, removeScenario, t]);

  useEffect(() => {
    if (scenario) {
      initialValuesRef.current = { ...scenario };
    } else {
      initialValuesRef.current = { ...emptyScenario };
    }
  }, [scenario]);

  const handleOnSubmit = (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (editionMode) {
      updateScenario();
    } else {
      createScenario();
    }
  };

  return (
    <Dialog
      data-testid="scenario-edition-modal"
      className="scenario-add-or-edit-modal"
      bodyClassname="scenario-add-or-edit-modal-body"
      footerClassname="scenario-add-or-edit-modal-footer"
      footer={
        <>
          {editionMode ? (
            <Button
              className="scenario-add-or-edit-modal-footer-left"
              variant="Destructive"
              type="button"
              size="medium"
              label={t('main.scenarioDeleteButton')}
              dataTestID="delete-scenario"
              onClick={() => openDeleteItemsModal()}
            />
          ) : undefined}
          <div className="scenario-add-or-edit-modal-footer-right">
            <Button
              variant="Cancel"
              type="reset"
              size="medium"
              label={t('main.scenarioCancel')}
              dataTestID="cancel-scenario"
              onClick={() => onCancel?.()}
            />
            {editionMode ? (
              <Button
                type="submit"
                form="form"
                size="medium"
                label={t('main.scenarioModificationTitle')}
                dataTestID="update-scenario"
                onClick={noop}
              />
            ) : (
              <Button
                type="submit"
                form="form"
                size="medium"
                label={t('main.scenarioCreateButton')}
                dataTestID="create-scenario"
                onClick={noop}
              />
            )}
          </div>
        </>
      }
      header={
        <h1>
          {editionMode ? t('main.scenarioModificationTitle') : t('main.scenarioCreationTitle')}
        </h1>
      }
    >
      <form id="form" className="scenario-add-or-edit-modal-form" onSubmit={handleOnSubmit}>
        <div className="scenario-add-or-edit-modal-form-info-section">
          <Input
            id="scenarioInputName"
            data-testid="scenarioInputName-input"
            type="text"
            name="scenarioInputName"
            label={t('main.scenarioName')}
            value={currentScenario.name || ''}
            onChange={(e) => handleScenarioInputChange('name', e.target.value)}
            statusWithMessage={
              displayErrors && invalidFields.name
                ? {
                    message: t('main.scenarioNameInvalid'),
                    status: 'error',
                  }
                : undefined
            }
          />

          <TextArea
            id="scenarioDescription"
            data-testid="scenarioDescription-input"
            label={t('main.scenarioDescription')}
            value={currentScenario.description || ''}
            onChange={(e) => handleScenarioInputChange('description', e.target.value)}
            placeholder={t('main.scenarioDescriptionPlaceholder')}
            statusWithMessage={
              displayErrors && invalidFields.description
                ? {
                    message: t('main.scenarioDescriptionInvalid'),
                    status: 'error',
                  }
                : undefined
            }
          />

          <TokenInput
            className="ui-feedback"
            label={t('main.scenarioTags')}
            tokens={currentScenario.tags || []}
            onChange={(newTags) => handleScenarioInputChange('tags', newTags)}
            dataTestId="scenarioTags"
          />
        </div>

        {hourlyTimetableActivated && !editionMode ? (
          <div className="scenario-add-or-edit-modal-system-hour-section">
            <RadioGroup
              value={currentScenario.timetable_type}
              onChange={(timetable_type) =>
                handleScenarioInputChange('timetable_type', timetable_type)
              }
              options={[
                {
                  id: 'HOURLY',
                  label: t('main.scenarioTimetableTypeHourly'),
                  value: 'HOURLY',
                },
                {
                  id: 'CALENDAR',
                  label: t('main.scenarioTimetableTypeCalendar'),
                  value: 'CALENDAR',
                },
              ]}
            />
          </div>
        ) : undefined}

        <div className="scenario-add-or-edit-modal-infra-section">
          <ComboBox
            id="scenario-add-or-edit-modal-infra-select"
            label={t('main.scenarioInfrastructureLabel')}
            autoComplete="off"
            value={infraValue || undefined}
            suggestions={infraSuggestions}
            getSuggestionLabel={(s) => getInfraLabel(s)}
            onSelectSuggestion={(s) => {
              handleScenarioInputChange('infra_id', s ? s.id : undefined);
            }}
            resetSuggestions={resetInfraSuggestions}
            onChange={onInfraQueryChange}
            data-testid="infra-combobox-input"
            testIdPrefix="infra-combobox"
            statusWithMessage={
              displayErrors && invalidFields.infra_id
                ? {
                    message: t('main.scenarioInfraInvalid'),
                    status: 'error',
                  }
                : undefined
            }
          />

          {!editionMode && electricalProfilOptions.length > 1 && (
            <Select
              id="electricalProfileSet"
              dataTestId="electrical-profile-select"
              label={t('main.electricalProfileSet')}
              value={selectedValue}
              options={electricalProfilOptions.map((e) => ({
                id: `${e.key}`,
                label: e.value,
              }))}
              getOptionValue={(ep) => ep.id}
              getOptionLabel={(ep) => ep.label}
              onChange={(e) => {
                handleScenarioInputChange('electrical_profile_set_id', e?.id ? +e.id : undefined);
              }}
            />
          )}
        </div>
      </form>
    </Dialog>
  );
};

export default AddOrEditScenarioModal;
