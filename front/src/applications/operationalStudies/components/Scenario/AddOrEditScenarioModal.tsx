import React, { useContext, useEffect, useMemo, useState } from 'react';
import scenarioLogo from 'assets/pictures/views/studies.svg';
import ChipsSNCF from 'common/BootstrapSNCF/ChipsSNCF';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import ModalBodySNCF from 'common/BootstrapSNCF/ModalSNCF/ModalBodySNCF';
import ModalFooterSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalFooterSNCF';
import ModalHeaderSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalHeaderSNCF';
import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import SelectImprovedSNCF from 'common/BootstrapSNCF/SelectImprovedSNCF';
import TextareaSNCF from 'common/BootstrapSNCF/TextareaSNCF';
import InfraSelectorModal from 'common/InfraSelector/InfraSelectorModal';
import { useTranslation } from 'react-i18next';
import { FaPencilAlt, FaPlus, FaTrash } from 'react-icons/fa';
import { GiElectric } from 'react-icons/gi';
import { MdDescription, MdTitle } from 'react-icons/md';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { setFailure, setSuccess } from 'reducers/main';
import { updateScenarioID } from 'reducers/osrdconf';
import { getInfraID, getProjectID, getStudyID } from 'reducers/osrdconf/selectors';
import { ScenarioListResult, osrdEditoastApi, ScenarioRequest } from 'common/api/osrdEditoastApi';
import { sortBy } from 'lodash';

const scenarioTypesDefaults = {
  name: '',
  description: '',
  infra: undefined,
};

type AddOrEditScenarioModalProps = {
  editionMode?: boolean;
  scenario?: ScenarioListResult;
  getScenarioTimetable?: (v: boolean) => void;
};

type SelectOptionsType = { key: number | undefined; value: string };

export default function AddOrEditScenarioModal({
  editionMode = false,
  scenario,
  getScenarioTimetable,
}: AddOrEditScenarioModalProps) {
  const { t } = useTranslation('operationalStudies/scenario');
  const { closeModal } = useContext(ModalContext);
  const noElectricalProfileSetOption = {
    key: undefined,
    value: t('noElectricalProfileSet'),
  };

  const [deleteScenarioRTK] =
    osrdEditoastApi.useDeleteProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdMutation({});
  const [patchScenario] =
    osrdEditoastApi.usePatchProjectsByProjectIdStudiesAndStudyIdScenariosScenarioIdMutation({});
  const [postScenario] =
    osrdEditoastApi.usePostProjectsByProjectIdStudiesAndStudyIdScenariosMutation({});
  const { electricalProfilOptions = [] } = osrdEditoastApi.useGetElectricalProfileSetQuery(
    undefined,
    {
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
    }
  );

  const [currentScenario, setCurrentScenario] = useState<ScenarioListResult>(
    scenario || scenarioTypesDefaults
  );

  const [displayErrors, setDisplayErrors] = useState(false);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const projectID = useSelector(getProjectID);
  const studyID = useSelector(getStudyID);
  const infraID = useSelector(getInfraID);

  const selectedValue: SelectOptionsType = useMemo(
    () =>
      electricalProfilOptions.find(
        (option) => option.key === currentScenario.electrical_profile_set_id
      ) || noElectricalProfileSetOption,
    [currentScenario.electrical_profile_set_id, electricalProfilOptions]
  );

  type ElectricalProfileSetType = { id: number; name: string };

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

  const createScenario = async () => {
    if (!currentScenario.name || !currentScenario.infra_id) {
      setDisplayErrors(true);
    } else if (projectID && studyID && currentScenario) {
      postScenario({
        projectId: projectID,
        studyId: studyID,
        scenarioRequest: currentScenario as ScenarioRequest,
      })
        .unwrap()
        .then(({ id }) => {
          dispatch(updateScenarioID(id));
          navigate('/operational-studies/scenario');
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

  const updateScenario = async () => {
    if (!currentScenario.name) {
      setDisplayErrors(true);
    } else if (scenario && projectID && studyID && scenario.id) {
      patchScenario({
        projectId: projectID,
        studyId: studyID,
        scenarioId: scenario.id,
        scenarioPatchRequest: currentScenario,
      })
        .unwrap()
        .then(() => {
          if (getScenarioTimetable) getScenarioTimetable(true);
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

  const deleteScenario = async () => {
    if (projectID && studyID && scenario?.id) {
      deleteScenarioRTK({ projectId: projectID, studyId: studyID, scenarioId: scenario.id })
        .unwrap()
        .then(() => {
          dispatch(updateScenarioID(undefined));
          navigate('/operational-studies/study');
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
          <img src={scenarioLogo} alt="scenario Logo" />
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
                value={currentScenario.name}
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
                value={currentScenario.description}
                onChange={(e) =>
                  setCurrentScenario({ ...currentScenario, description: e.target.value })
                }
              />
            </div>
            {!editionMode && electricalProfilOptions.length > 1 && (
              <div className="scenario-edition-modal-description">
                <SelectImprovedSNCF
                  title={
                    <div className="d-flex align-items-center">
                      <span className="mr-2">
                        <GiElectric />
                      </span>
                      {t('electricalProfileSet')}
                    </div>
                  }
                  selectedValue={selectedValue}
                  options={electricalProfilOptions}
                  onChange={(e: SelectOptionsType) =>
                    setCurrentScenario({ ...currentScenario, electrical_profile_set_id: e.key })
                  }
                />
              </div>
            )}
            <ChipsSNCF
              addTag={addTag}
              tags={currentScenario.tags}
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
              className="btn btn-sm btn-outline-danger mr-auto"
              type="button"
              onClick={deleteScenario}
            >
              <span className="mr-2">
                <FaTrash />
              </span>
              {t('scenarioDeleteButton')}
            </button>
          )}
          <button className="btn btn-sm btn-secondary mr-2" type="button" onClick={closeModal}>
            {t('scenarioCancel')}
          </button>
          {editionMode ? (
            <button className="btn btn-sm btn-warning" type="button" onClick={updateScenario}>
              <span className="mr-2">
                <FaPencilAlt />
              </span>
              {t('scenarioModifyButton')}
            </button>
          ) : (
            <button className="btn btn-sm btn-primary" type="button" onClick={createScenario}>
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
