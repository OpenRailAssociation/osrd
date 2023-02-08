/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useContext, useEffect, useState } from 'react';
import ModalHeaderSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalHeaderSNCF';
import ModalBodySNCF from 'common/BootstrapSNCF/ModalSNCF/ModalBodySNCF';
import studyLogo from 'assets/pictures/views/studies.svg';
import { useTranslation } from 'react-i18next';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import TextareaSNCF from 'common/BootstrapSNCF/TextareaSNCF';
import ModalFooterSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalFooterSNCF';
import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import ChipsSNCF from 'common/BootstrapSNCF/ChipsSNCF';
import { FaPencilAlt, FaPlus, FaTasks, FaTrash } from 'react-icons/fa';
import { MdBusinessCenter, MdTitle } from 'react-icons/md';
import { RiCalendarLine, RiMoneyEuroCircleLine, RiQuestionLine } from 'react-icons/ri';
import { useSelector, useDispatch } from 'react-redux';
import { getProjectID } from 'reducers/osrdconf/selectors';
import { deleteRequest, get, patch, post } from 'common/requests';
import { useNavigate } from 'react-router-dom';
import { updateStudyID } from 'reducers/osrdconf';
import { setSuccess } from 'reducers/main';
import { GoNote } from 'react-icons/go';
import SelectImprovedSNCF from 'common/BootstrapSNCF/SelectImprovedSNCF';
import { PROJECTS_URI, STUDIES_URI } from '../operationalStudiesConsts';

const configItemsDefaults = {
  name: '',
  type: '',
  description: '',
  service_code: '',
  business_code: '',
  start_date: null,
  expected_end_date: null,
  actual_end_date: null,
  state: '',
  tags: [],
  budget: 0,
};

type configItemsTypes = {
  id?: number;
  name: string;
  type: string;
  description: string;
  service_code: string;
  business_code: string;
  start_date: string | null;
  expected_end_date: string | null;
  actual_end_date: string | null;
  state: string;
  tags: string[];
  budget: number;
};

type Props = {
  editionMode: false;
  study?: configItemsTypes;
  getStudy?: any;
};

type SelectOptions = { key: string | null; value: string }[];

export default function AddOrEditStudyModal({ editionMode, study, getStudy }: Props) {
  const { t } = useTranslation('operationalStudies/study');
  const { closeModal } = useContext(ModalContext);
  const [configItems, setConfigItems] = useState<configItemsTypes>(study || configItemsDefaults);
  const [displayErrors, setDisplayErrors] = useState(false);
  const emptyOptions = [{ key: null, value: t('nothingSelected') }];
  const [studyTypes, setStudyTypes] = useState<SelectOptions>(emptyOptions);
  const [studyStates, setStudyStates] = useState<SelectOptions>(emptyOptions);
  const projectID = useSelector(getProjectID);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const rootURI = `${PROJECTS_URI}${projectID}${STUDIES_URI}`;

  const createSelectOptions = async (
    translationList: string,
    enumURI: string,
    setFunction: (func: SelectOptions) => void
  ) => {
    try {
      const list = await get(enumURI);
      const options: SelectOptions = [];
      list.forEach((key: string) => {
        options.push({ key, value: t(`${translationList}.${key}`) });
      });
      options.sort((a, b) => a.value.localeCompare(b.value));
      options.unshift({ key: null, value: t(`${translationList}.nothingSelected`) });
      setFunction(options);
    } catch (error) {
      console.log(error);
    }
  };

  const formatDateForInput = (date: string | null) => (date === null ? '' : date.substr(0, 10));

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

  const createStudy = async () => {
    if (!configItems.name) {
      setDisplayErrors(true);
    } else {
      try {
        const result = await post(`${rootURI}`, configItems);
        dispatch(updateStudyID(result.id));
        navigate('/operational-studies/study');
        closeModal();
      } catch (error) {
        console.error(error);
      }
    }
  };

  const modifyStudy = async () => {
    if (!configItems.name) {
      setDisplayErrors(true);
    } else if (study) {
      try {
        await patch(`${rootURI}${study.id}/`, configItems);
        getStudy(true);
        closeModal();
      } catch (error) {
        console.error(error);
      }
    }
  };

  const deleteStudy = async () => {
    if (study) {
      try {
        await deleteRequest(`${rootURI}${study.id}/`);
        dispatch(updateStudyID(undefined));
        navigate('/operational-studies/project');
        closeModal();
        dispatch(
          setSuccess({
            title: t('studyDeleted'),
            text: t('studyDeletedDetails', { name: study.name }),
          })
        );
      } catch (error) {
        console.error(error);
      }
    }
  };

  useEffect(() => {
    createSelectOptions('studyTypes', `/projects/${configItems.id}/study_types/`, setStudyTypes);
    createSelectOptions('studyStates', `/projects/${configItems.id}/study_states/`, setStudyStates);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="study-edition-modal">
      <ModalHeaderSNCF withCloseButton withBorderBottom>
        <h1 className="study-edition-modal-title">
          <img src={studyLogo} alt="Study Logo" />
          {editionMode ? t('studyModificationTitle') : t('studyCreationTitle')}
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
            <div className="row">
              <div className="col-xl-6">
                <div className="study-edition-modal-type mb-2">
                  <SelectImprovedSNCF
                    title={
                      <div className="d-flex align-items-center">
                        <span className="mr-2">
                          <RiQuestionLine />
                        </span>
                        {t('studyType')}
                      </div>
                    }
                    selectedValue={{
                      key: configItems.type,
                      value: t(`studyTypes.${configItems.type || 'nothingSelected'}`),
                    }}
                    options={studyTypes}
                    onChange={(e: any) => setConfigItems({ ...configItems, type: e.key })}
                  />
                </div>
              </div>
              <div className="col-xl-6">
                <div className="study-edition-modal-state mb-2">
                  <SelectImprovedSNCF
                    title={
                      <div className="d-flex align-items-center">
                        <span className="mr-2">
                          <FaTasks />
                        </span>
                        {t('studyState')}
                      </div>
                    }
                    selectedValue={{
                      key: configItems.state,
                      value: t(`studyStates.${configItems.state || 'nothingSelected'}`),
                    }}
                    options={studyStates}
                    onChange={(e: any) => setConfigItems({ ...configItems, state: e.key })}
                  />
                </div>
              </div>
            </div>
            <div className="study-edition-modal-description">
              <TextareaSNCF
                id="studyDescription"
                label={
                  <div className="d-flex align-items-center">
                    <span className="mr-2">
                      <GoNote />
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
              value={formatDateForInput(configItems.start_date)}
              onChange={(e: any) => setConfigItems({ ...configItems, start_date: e.target.value })}
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
              value={formatDateForInput(configItems.expected_end_date)}
              onChange={(e: any) =>
                setConfigItems({ ...configItems, expected_end_date: e.target.value })
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
              value={formatDateForInput(configItems.actual_end_date)}
              onChange={(e: any) =>
                setConfigItems({ ...configItems, actual_end_date: e.target.value })
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
              value={configItems.service_code}
              onChange={(e: any) =>
                setConfigItems({ ...configItems, service_code: e.target.value })
              }
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
              value={configItems.business_code}
              onChange={(e: any) =>
                setConfigItems({ ...configItems, business_code: e.target.value })
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
          {editionMode && (
            <button className="btn btn-outline-danger mr-auto" type="button" onClick={deleteStudy}>
              <span className="mr-2">
                <FaTrash />
              </span>
              {t('studyDeleteButton')}
            </button>
          )}
          <button className="btn btn-secondary mr-2" type="button" onClick={closeModal}>
            {t('studyCancel')}
          </button>
          {editionMode ? (
            <button className="btn btn-warning" type="button" onClick={modifyStudy}>
              <span className="mr-2">
                <FaPencilAlt />
              </span>
              {t('studyModifyButton')}
            </button>
          ) : (
            <button className="btn btn-primary" type="button" onClick={createStudy}>
              <span className="mr-2">
                <FaPlus />
              </span>
              {t('studyCreateButton')}
            </button>
          )}
        </div>
      </ModalFooterSNCF>
    </div>
  );
}
