import React, { useContext, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GoPencil, GoTrash } from 'react-icons/go';
import { FaPlus } from 'react-icons/fa';
import { GiElectric } from 'react-icons/gi';
import { MdDescription, MdTitle } from 'react-icons/md';
import { useDispatch } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import { sortBy } from 'lodash';

import ChipsSNCF from 'common/BootstrapSNCF/ChipsSNCF';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import TextareaSNCF from 'common/BootstrapSNCF/TextareaSNCF';
import { useInfraID, useOsrdConfActions } from 'common/osrdContext';
import SelectImprovedSNCF from 'common/BootstrapSNCF/SelectImprovedSNCF';
import ModalBodySNCF from 'common/BootstrapSNCF/ModalSNCF/ModalBodySNCF';
import InfraSelectorModal from 'common/InfraSelector/InfraSelectorModal';
import ModalFooterSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalFooterSNCF';
import ModalHeaderSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalHeaderSNCF';
import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import type { ScenarioCreateForm, ScenarioPatchForm } from 'common/api/osrdEditoastApi';

import { setFailure, setSuccess } from 'reducers/main';

type CreateOrPatchScenarioForm = ScenarioPatchForm & {
  id?: number;
  infra_id?: number;
  electrical_profile_set_id?: number | null;
};

type AddOrEditScenarioModalProps = {
  editionMode?: boolean;
  scenario?: CreateOrPatchScenarioForm;
};

type createScenarioParams = {
  projectId: string;
  studyId: string;
};

export default function AddOrEditScenarioModal({
  editionMode = false,
  scenario,
}: AddOrEditScenarioModalProps) {
  const { t } = useTranslation('operationalStudies/scenario');
  const { closeModal } = useContext(ModalContext);
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

  const [currentScenario, setCurrentScenario] = useState<CreateOrPatchScenarioForm>(scenario || {});

  const [displayErrors, setDisplayErrors] = useState(false);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const infraID = useInfraID();

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

  const removeTag = (idx: number) => {
    const newTags = currentScenario.tags ? Array.from(currentScenario.tags) : [];
    newTags.splice(idx, 1);
    setCurrentScenario({ ...currentScenario, tags: newTags });
  };

  const addTag = (tag: string) => {
    const newTags = currentScenario.tags ? Array.from(currentScenario.tags) : [];
    newTags.push(tag);
    setCurrentScenario({ ...currentScenario, tags: newTags });
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
          console.error(error);
          dispatch(
            setFailure({
              name: t('errorMessages.error'),
              message: t('errorMessages.unableToCreateScenarioMessage'),
            })
          );
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
          console.error(error);
          dispatch(
            setFailure({
              name: t('errorMessages.error'),
              message: t('errorMessages.unableToUpdateScenarioMessage'),
            })
          );
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
    setCurrentScenario({ ...currentScenario, infra_id: infraID });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [infraID]);

  return (
    <div className="scenario-edition-modal">
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
                label={
                  <div className="d-flex align-items-center">
                    <span className="mr-2">
                      <MdTitle />
                    </span>
                    <span className="font-weight-bold">{t('scenarioName')}</span>
                  </div>
                }
                value={currentScenario.name || ''}
                onChange={(e) => setCurrentScenario({ ...currentScenario, name: e.target.value })}
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
                onChange={(e) =>
                  setCurrentScenario({ ...currentScenario, description: e.target.value })
                }
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
                    setCurrentScenario({
                      ...currentScenario,
                      electrical_profile_set_id: e?.id ? +e.id : undefined,
                    })
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
                className={`scenario-edition-modal-infraselector ${
                  displayErrors && !currentScenario.infra_id
                    ? 'scenario-edition-modal-infraselector-missing'
                    : null
                }`}
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
                <GoTrash />
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
                <GoPencil />
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
