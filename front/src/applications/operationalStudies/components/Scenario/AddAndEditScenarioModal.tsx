import React, { useContext, useState } from 'react';
import ModalHeaderSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalHeaderSNCF';
import ModalBodySNCF from 'common/BootstrapSNCF/ModalSNCF/ModalBodySNCF';
import scenarioLogo from 'assets/pictures/views/studies.svg';
import { useTranslation } from 'react-i18next';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import TextareaSNCF from 'common/BootstrapSNCF/TextareaSNCF';
import ModalFooterSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalFooterSNCF';
import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import ChipsSNCF from 'common/BootstrapSNCF/ChipsSNCF';
import { FaPlus } from 'react-icons/fa';
import { MdDescription, MdTitle } from 'react-icons/md';
import InfraSelectorModal from 'common/InfraSelector/InfraSelectorModal';
import { getInfraID, getProjectID, getStudyID } from 'reducers/osrdconf/selectors';
import { useSelector, useDispatch } from 'react-redux';
import { post } from 'common/requests';
import { useNavigate } from 'react-router-dom';
import { updateScenarioID } from 'reducers/osrdconf';
import { PROJECTS_URI, SCENARIOS_URI, STUDIES_URI } from '../operationalStudiesConsts';

const configItemsDefaults = {
  name: '',
  description: '',
  infra: undefined,
  tags: [],
};

type configItemsTypes = {
  name: string;
  description: string;
  infra: number | undefined;
  tags: string[];
};

export default function AddAndEditScenarioModal() {
  const { t } = useTranslation('operationalStudies/scenario');
  const { closeModal } = useContext(ModalContext);
  const [configItems, setConfigItems] = useState<configItemsTypes>(configItemsDefaults);
  const [displayErrors, setDisplayErrors] = useState(false);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const projectID = useSelector(getProjectID);
  const studyID = useSelector(getStudyID);
  const infraID = useSelector(getInfraID);

  const removeTag = (idx: number) => {
    const newTags: string[] = Array.from(configItems.tags);
    newTags.splice(idx, 1);
    setConfigItems({ ...configItems, tags: newTags });
  };

  const addTag = (tag: string) => {
    const newTags: string[] = Array.from(configItems.tags);
    newTags.push(tag);
    setConfigItems({ ...configItems, tags: newTags });
  };

  const createScenario = async () => {
    if (!configItems.name) {
      setDisplayErrors(true);
    } else {
      try {
        const result = await post(
          `${PROJECTS_URI}${projectID}${STUDIES_URI}${studyID}${SCENARIOS_URI}`,
          { ...configItems, infra: infraID }
        );
        dispatch(updateScenarioID(result.id));
        navigate('/operational-studies/scenario');
        closeModal();
      } catch (error) {
        console.error(error);
      }
    }
  };

  return (
    <div className="scenario-edition-modal">
      <ModalHeaderSNCF withCloseButton withBorderBottom>
        <h1 className="scenario-edition-modal-title">
          <img src={scenarioLogo} alt="scenario Logo" />
          {t('scenarioCreationTitle')}
        </h1>
      </ModalHeaderSNCF>
      <ModalBodySNCF>
        <div className="row">
          <div className="col-lg-6">
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
                value={configItems.name}
                onChange={(e: any) => setConfigItems({ ...configItems, name: e.target.value })}
                isInvalid={displayErrors && !configItems.name}
                errorMsg={displayErrors && !configItems.name ? t('scenarioNameMissing') : undefined}
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
                value={configItems.description}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                onChange={(e: any) =>
                  setConfigItems({ ...configItems, description: e.target.value })
                }
              />
            </div>
            <ChipsSNCF
              addTag={addTag}
              tags={configItems.tags}
              removeTag={removeTag}
              title={t('scenarioTags')}
              color="secondary"
            />
          </div>
          <div className="col-lg-6">
            <div className="scenario-edition-modal-infraselector">
              <InfraSelectorModal onlySelectionMode />
            </div>
          </div>
        </div>
      </ModalBodySNCF>
      <ModalFooterSNCF>
        <div className="d-flex justify-content-end w-100">
          <button className="btn btn-secondary mr-2" type="button" onClick={closeModal}>
            {t('scenarioCancel')}
          </button>
          <button className="btn btn-primary" type="button" onClick={createScenario}>
            <span className="mr-2">
              <FaPlus />
            </span>
            {t('scenarioCreateButton')}
          </button>
        </div>
      </ModalFooterSNCF>
    </div>
  );
}
