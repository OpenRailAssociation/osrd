import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';

import { Pencil, Trash } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { sortBy } from 'lodash';
import { useTranslation } from 'react-i18next';
import { FaPlus } from 'react-icons/fa';
import { GiElectric } from 'react-icons/gi';
import { MdDescription, MdTitle } from 'react-icons/md';
import { useNavigate, useParams } from 'react-router-dom';

import {
  type ScenarioCreateForm,
  type ScenarioPatchForm,
  osrdEditoastApi,
} from 'common/api/osrdEditoastApi';
import ChipsSNCF from 'common/BootstrapSNCF/ChipsSNCF';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { ConfirmModal } from 'common/BootstrapSNCF/ModalSNCF';
import ModalBodySNCF from 'common/BootstrapSNCF/ModalSNCF/ModalBodySNCF';
import ModalFooterSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalFooterSNCF';
import ModalHeaderSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalHeaderSNCF';
import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import SelectImprovedSNCF from 'common/BootstrapSNCF/SelectImprovedSNCF';
import TextareaSNCF from 'common/BootstrapSNCF/TextareaSNCF';
import { useInfraID, useOsrdConfActions } from 'common/osrdContext';
import { InfraSelectorModal } from 'modules/infra/components/InfraSelector';
import { setFailure, setSuccess } from 'reducers/main';
import { useAppDispatch } from 'store';
import { castErrorToFailure } from 'utils/error';
import useInputChange from 'utils/hooks/useInputChange';
import useModalFocusTrap from 'utils/hooks/useModalFocusTrap';
import useOutsideClick from 'utils/hooks/useOutsideClick';

type ScenarioForm = ScenarioPatchForm & {
  id?: number;
  infra_id?: number;
  electrical_profile_set_id?: number | null;
};

type AddOrEditScenarioModalProps = {
  editionMode?: boolean;
  scenario?: ScenarioForm;
};

type createScenarioParams = {
  projectId: string;
  studyId: string;
};

export default function AddOrEditScenarioModal({
  editionMode = false,
  scenario,
}: AddOrEditScenarioModalProps) {
  const { t } = useTranslation(['operationalStudies/scenario', 'translation']);
  const { closeModal, isOpen } = useContext(ModalContext);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const infraID = useInfraID();

  const emptyScenario: ScenarioForm = {
    description: '',
    electrical_profile_set_id: NaN,
    infra_id: infraID,
    name: '',
    tags: [],
  };
  const [currentScenario, setCurrentScenario] = useState<ScenarioForm>(scenario || emptyScenario);

  const noElectricalProfileSetOption = {
    key: undefined,
    value: t('noElectricalProfileSet').toString(),
  };

  const { projectId, studyId } = useParams() as createScenarioParams;

  const [deleteScenario] =
    osrdEditoastApi.endpoints.deleteProjectsByProjectIdStudiesAndStudyIdScenariosScenarioId.useMutation(
      {}
    );
  const [patchScenario] =
    osrdEditoastApi.endpoints.patchProjectsByProjectIdStudiesAndStudyIdScenariosScenarioId.useMutation(
      {}
    );
  const [postScenario] =
    osrdEditoastApi.endpoints.postProjectsByProjectIdStudiesAndStudyIdScenarios.useMutation({});
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
  const [loadInfra] = osrdEditoastApi.endpoints.postInfraByIdLoad.useMutation();

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

  type ElectricalProfileSetType = { id: number; name: string };

  const { updateScenarioID } = useOsrdConfActions();

  const initialValuesRef = useRef<ScenarioForm | null>(null);

  const modalRef = useRef<HTMLDivElement | null>(null);

  const { clickedOutside, setHasChanges, resetClickedOutside } = useOutsideClick(
    modalRef,
    closeModal,
    isOpen
  );

  const handleScenarioInputChange = useInputChange(
    initialValuesRef,
    setCurrentScenario,
    setHasChanges
  );

  const removeTag = (idx: number) => {
    const newTags = [...(currentScenario.tags || [])];
    newTags.splice(idx, 1);
    setCurrentScenario({ ...currentScenario, tags: newTags });
    handleScenarioInputChange('tags', newTags);
  };

  const addTag = (tag: string) => {
    const newTags = [...(currentScenario.tags || []), tag];
    setCurrentScenario({ ...currentScenario, tags: newTags });
    handleScenarioInputChange('tags', newTags);
  };

  const createScenario = () => {
    if (!currentScenario.name || !currentScenario.infra_id) {
      setDisplayErrors(true);
    } else if (projectId && studyId && currentScenario) {
      postScenario({
        projectId: +projectId,
        studyId: +studyId,
        scenarioCreateForm: currentScenario as ScenarioCreateForm,
      })
        .unwrap()
        .then(({ id }) => {
          dispatch(updateScenarioID(id));
          loadInfra({ id: infraID as number }).unwrap();
          navigate(`projects/${projectId}/studies/${studyId}/scenarios/${id}`);
          closeModal();
        })

        .catch((error) => {
          dispatch(setFailure(castErrorToFailure(error)));
        });
    }
  };

  const updateScenario = () => {
    if (!currentScenario.name) {
      setDisplayErrors(true);
    } else if (scenario && projectId && studyId && scenario.id) {
      patchScenario({
        projectId: +projectId,
        studyId: +studyId,
        scenarioId: scenario.id,
        scenarioPatchForm: currentScenario,
      })
        .unwrap()
        .then(() => {
          dispatch(
            setSuccess({
              title: t('scenarioUpdated'),
              text: t('scenarioUpdatedDetails', { name: currentScenario.name }),
            })
          );
          closeModal();
        })
        .catch((error) => {
          dispatch(setFailure(castErrorToFailure(error)));
        });
    }
  };

  const removeScenario = () => {
    if (projectId && studyId && scenario?.id) {
      deleteScenario({ projectId: +projectId, studyId: +studyId, scenarioId: scenario.id })
        .unwrap()
        .then(() => {
          dispatch(updateScenarioID(undefined));
          navigate(`projects/${projectId}/studies/${studyId}`);
          closeModal();
          dispatch(
            setSuccess({
              title: t('scenarioDeleted'),
              text: t('scenarioDeletedDetails', { name: scenario.name }),
            })
          );
        })
        .catch((error) => {
          console.error(error);
          dispatch(
            setFailure({
              name: t('errorMessages.error'),
              message: t('errorMessages.unableToDeleteScenarioMessage'),
            })
          );
        });
    }
  };

  useEffect(() => {
    if (scenario) {
      initialValuesRef.current = { ...scenario };
    } else {
      initialValuesRef.current = { ...emptyScenario };
    }
  }, [scenario]);

  useEffect(() => {
    setCurrentScenario({ ...currentScenario, infra_id: infraID });
  }, [infraID]);

  useModalFocusTrap(modalRef, closeModal);

  return (
    <div className="scenario-edition-modal" ref={modalRef}>
      {clickedOutside && (
        <div className="confirm-modal">
          <div className="confirm-modal-content">
            <ConfirmModal
              title={t('common.leaveEditionMode', { ns: 'translation' })}
              onConfirm={closeModal}
              onCancel={resetClickedOutside}
              withCloseButton={false}
            />
          </div>
        </div>
      )}
      <ModalHeaderSNCF withCloseButton withBorderBottom>
        <h1 className="scenario-edition-modal-title">
          {editionMode ? t('scenarioModificationTitle') : t('scenarioCreationTitle')}
        </h1>
      </ModalHeaderSNCF>
      <ModalBodySNCF>
        <div className="row">
          <div className={editionMode ? 'col-lg-12' : 'col-lg-6'}>
            <div className="scenario-edition-modal-name">
              <InputSNCF
                id="scenarioInputName"
                type="text"
                name="scenarioInputName"
                focus
                label={
                  <div className="d-flex align-items-center">
                    <span className="mr-2">
                      <MdTitle />
                    </span>
                    <span className="font-weight-bold">{t('scenarioName')}</span>
                  </div>
                }
                value={currentScenario.name || ''}
                onChange={(e) => handleScenarioInputChange('name', e.target.value)}
                isInvalid={displayErrors && !currentScenario.name}
                errorMsg={
                  displayErrors && !currentScenario.name ? t('scenarioNameMissing') : undefined
                }
              />
            </div>
            <div className="scenario-edition-modal-description">
              <TextareaSNCF
                id="scenarioDescription"
                label={
                  <div className="d-flex align-items-center">
                    <span className="mr-2">
                      <MdDescription />
                    </span>
                    {t('scenarioDescription')}
                  </div>
                }
                value={currentScenario.description || ''}
                onChange={(e) => handleScenarioInputChange('description', e.target.value)}
                placeholder={t('scenarioDescriptionPlaceholder')}
              />
            </div>
            {!editionMode && electricalProfilOptions.length > 1 && (
              <div className="scenario-edition-modal-description">
                <SelectImprovedSNCF
                  label={
                    <div className="d-flex align-items-center">
                      <span className="mr-2">
                        <GiElectric />
                      </span>
                      {t('electricalProfileSet')}
                    </div>
                  }
                  value={selectedValue}
                  options={electricalProfilOptions.map((e) => ({
                    id: `${e.key}`,
                    label: e.value,
                  }))}
                  onChange={(e) =>
                    handleScenarioInputChange(
                      'electrical_profile_set_id',
                      e?.id ? +e.id : undefined
                    )
                  }
                />
              </div>
            )}
            <ChipsSNCF
              addTag={addTag}
              tags={currentScenario.tags || []}
              removeTag={removeTag}
              title={t('scenarioTags')}
              color="teal"
            />
          </div>
          {!editionMode && (
            <div className="col-lg-6">
              <div
                className={cx('scenario-edition-modal-infraselector', {
                  'scenario-edition-modal-infraselector-missing':
                    displayErrors && !currentScenario.infra_id,
                })}
              >
                <InfraSelectorModal onlySelectionMode />
              </div>
            </div>
          )}
        </div>
      </ModalBodySNCF>
      <ModalFooterSNCF>
        <div className="d-flex justify-content-end w-100 mt-3">
          {editionMode && (
            <button
              data-testid="deleteScenario"
              className="btn btn-sm btn-outline-danger mr-auto"
              type="button"
              onClick={removeScenario}
            >
              <span className="mr-2">
                <Trash />
              </span>
              {t('scenarioDeleteButton')}
            </button>
          )}
          <button className="btn btn-sm btn-secondary mr-2" type="button" onClick={closeModal}>
            {t('scenarioCancel')}
          </button>
          {editionMode ? (
            <button
              data-testid="updateScenario"
              className="btn btn-sm btn-warning"
              type="button"
              onClick={updateScenario}
            >
              <span className="mr-2">
                <Pencil />
              </span>
              {t('scenarioModifyButton')}
            </button>
          ) : (
            <button
              data-testid="createScenario"
              className="btn btn-sm btn-primary"
              type="button"
              onClick={createScenario}
            >
              <span className="mr-2">
                <FaPlus />
              </span>
              {t('scenarioCreateButton')}
            </button>
          )}
        </div>
      </ModalFooterSNCF>
    </div>
  );
}
