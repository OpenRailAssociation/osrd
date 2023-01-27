import React, { useContext, useState } from 'react';
import ModalHeaderSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalHeaderSNCF';
import ModalBodySNCF from 'common/BootstrapSNCF/ModalSNCF/ModalBodySNCF';
import studyLogo from 'assets/pictures/views/studies.svg';
import { useTranslation } from 'react-i18next';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import TextareaSNCF from 'common/BootstrapSNCF/TextareaSNCF';
import ModalFooterSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalFooterSNCF';
import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import ChipsSNCF from 'common/BootstrapSNCF/ChipsSNCF';
import { FaPlus } from 'react-icons/fa';
import { MdBusinessCenter, MdDescription, MdList, MdTitle } from 'react-icons/md';
import { RiCalendarLine, RiMoneyEuroCircleLine } from 'react-icons/ri';

const configItemsDefaults = {
  name: '',
  type: '',
  description: '',
  serviceCode: '',
  businessCode: '',
  startDate: null,
  estimatedEndingDate: null,
  realEndingDate: null,
  step: '',
  tags: [],
  budget: 0,
};

type configItemsTypes = {
  name: string;
  type: string;
  description: string;
  serviceCode: string;
  businessCode: string;
  startDate: any;
  estimatedEndingDate: any;
  realEndingDate: any;
  step: string;
  tags: string[];
  budget: number;
};

export default function AddAndEditStudyModal() {
  const { t } = useTranslation('operationalStudies/study');
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

  const createStudy = () => {
    if (!configItems.name) {
      setDisplayErrors(true);
    }
  };

  return (
    <div className="study-edition-modal">
      <ModalHeaderSNCF>
        <h1 className="study-edition-modal-title">
          <img src={studyLogo} alt="Study Logo" />
          {t('studyCreationTitle')}
        </h1>
      </ModalHeaderSNCF>
      <ModalBodySNCF>
        <div className="study-edition-modal-name">
          <InputSNCF
            id="studyInputName"
            type="text"
            name="studyInputName"
            label={
              <div className="d-flex align-items-center">
                <span className="mr-2">
                  <MdTitle />
                </span>
                <span className="font-weight-bold">{t('studyName')}</span>
              </div>
            }
            value={configItems.name}
            onChange={(e: any) => setConfigItems({ ...configItems, name: e.target.value })}
            isInvalid={displayErrors && !configItems.name}
            errorMsg={displayErrors && !configItems.name ? t('studyNameMissing') : undefined}
          />
        </div>
        <div className="row">
          <div className="col-lg-8">
            <div className="study-edition-modal-type">
              <InputSNCF
                id="studyInputType"
                type="text"
                name="studyInputType"
                label={
                  <div className="d-flex align-items-center">
                    <span className="mr-2">
                      <MdList />
                    </span>
                    {t('studyType')}
                  </div>
                }
                value={configItems.type}
                onChange={(e: any) => setConfigItems({ ...configItems, type: e.target.value })}
              />
            </div>
            <div className="study-edition-modal-description">
              <TextareaSNCF
                id="studyDescription"
                label={
                  <div className="d-flex align-items-center">
                    <span className="mr-2">
                      <MdDescription />
                    </span>
                    {t('studyDescription')}
                  </div>
                }
                value={configItems.description}
                onChange={(e: any) =>
                  setConfigItems({ ...configItems, description: e.target.value })
                }
              />
            </div>
          </div>
          <div className="col-lg-4">
            <InputSNCF
              id="studyInputStartDate"
              type="date"
              name="studyInputStartDate"
              label={
                <div className="d-flex align-items-center">
                  <span className="mr-2 text-success">
                    <RiCalendarLine />
                  </span>
                  {t('studyStartDate')}
                </div>
              }
              value={configItems.startDate}
              onChange={(e: any) => setConfigItems({ ...configItems, startDate: e.target.value })}
            />
            <InputSNCF
              id="studyInputEstimatedEndingDate"
              type="date"
              name="studyInputEstimatedEndingDate"
              label={
                <div className="d-flex align-items-center">
                  <span className="mr-2 text-warning">
                    <RiCalendarLine />
                  </span>
                  {t('studyEstimatedEndingDate')}
                </div>
              }
              value={configItems.estimatedEndingDate}
              onChange={(e: any) =>
                setConfigItems({ ...configItems, estimatedEndingDate: e.target.value })
              }
            />
            <InputSNCF
              id="studyInputRealEndingDate"
              type="date"
              name="studyInputRealEndingDate"
              label={
                <div className="d-flex align-items-center">
                  <span className="mr-2 text-danger">
                    <RiCalendarLine />
                  </span>
                  {t('studyRealEndingDate')}
                </div>
              }
              value={configItems.realEndingDate}
              onChange={(e: any) =>
                setConfigItems({ ...configItems, realEndingDate: e.target.value })
              }
            />
          </div>
        </div>
        <div className="row">
          <div className="col-lg-4">
            <InputSNCF
              id="studyInputServiceCode"
              type="text"
              name="studyInputServiceCode"
              label={
                <div className="d-flex align-items-center">
                  <span className="mr-2">
                    <MdBusinessCenter />
                  </span>
                  {t('studyServiceCode')}
                </div>
              }
              value={configItems.serviceCode}
              onChange={(e: any) => setConfigItems({ ...configItems, serviceCode: e.target.value })}
            />
          </div>
          <div className="col-lg-4">
            <InputSNCF
              id="studyInputBusinessCode"
              type="text"
              name="studyInputBusinessCode"
              label={
                <div className="d-flex align-items-center">
                  <span className="mr-2">
                    <MdBusinessCenter />
                  </span>
                  {t('studyBusinessCode')}
                </div>
              }
              value={configItems.businessCode}
              onChange={(e: any) =>
                setConfigItems({ ...configItems, businessCode: e.target.value })
              }
            />
          </div>
          <div className="col-lg-4">
            <InputSNCF
              id="studyInputBudget"
              type="number"
              name="studyInputBudget"
              unit="€"
              label={
                <div className="d-flex align-items-center">
                  <span className="mr-2">
                    <RiMoneyEuroCircleLine />
                  </span>
                  {t('studyBudget')}
                </div>
              }
              value={configItems.budget}
              onChange={(e: any) => setConfigItems({ ...configItems, budget: e.target.value })}
            />
          </div>
        </div>
        <ChipsSNCF
          addTag={addTag}
          tags={configItems.tags}
          removeTag={removeTag}
          title={t('studyTags')}
          color="primary"
        />
      </ModalBodySNCF>
      <ModalFooterSNCF>
        <div className="d-flex justify-content-end w-100">
          <button className="btn btn-secondary mr-2" type="button" onClick={closeModal}>
            {t('studyCancel')}
          </button>
          <button className="btn btn-primary" type="button" onClick={createStudy}>
            <span className="mr-2">
              <FaPlus />
            </span>
            {t('studyCreateButton')}
          </button>
        </div>
      </ModalFooterSNCF>
    </div>
  );
}
