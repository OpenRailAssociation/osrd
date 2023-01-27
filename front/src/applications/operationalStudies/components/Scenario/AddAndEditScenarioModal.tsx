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

const configItemsDefaults = {
  name: '',
  description: '',
  infraID: undefined,
  tags: [],
};

type configItemsTypes = {
  name: string;
  description: string;
  infraID: number | undefined;
  tags: string[];
};

export default function AddAndEditScenarioModal() {
  const { t } = useTranslation('operationalStudies/scenario');
  const { closeModal } = useContext(ModalContext);
  const [configItems, setConfigItems] = useState<configItemsTypes>(configItemsDefaults);
  const [displayErrors, setDisplayErrors] = useState(false);

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

  const createScenario = () => {
    if (!configItems.name) {
      setDisplayErrors(true);
    }
  };

  return (
    <div className="scenario-edition-modal">
      <ModalHeaderSNCF>
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
            <InfraSelectorModal />
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
