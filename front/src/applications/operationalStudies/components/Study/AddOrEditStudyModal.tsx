import React, { useContext, useEffect, useState } from 'react';
import studyLogo from 'assets/pictures/views/studies.svg';
import ChipsSNCF from 'common/BootstrapSNCF/ChipsSNCF';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import ModalBodySNCF from 'common/BootstrapSNCF/ModalSNCF/ModalBodySNCF';
import ModalFooterSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalFooterSNCF';
import ModalHeaderSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalHeaderSNCF';
import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import SelectImprovedSNCF from 'common/BootstrapSNCF/SelectImprovedSNCF';
import TextareaSNCF from 'common/BootstrapSNCF/TextareaSNCF';
import { deleteRequest, get, patch, post } from 'common/requests';
import { useTranslation } from 'react-i18next';
import { FaPencilAlt, FaPlus, FaTasks, FaTrash } from 'react-icons/fa';
import { GoNote } from 'react-icons/go';
import { MdBusinessCenter, MdTitle } from 'react-icons/md';
import { RiCalendarLine, RiMoneyEuroCircleLine, RiQuestionLine } from 'react-icons/ri';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { setSuccess } from 'reducers/main';
import { updateStudyID } from 'reducers/osrdconf';
import { getProjectID } from 'reducers/osrdconf/selectors';
import { StudyResult } from 'common/api/osrdEditoastApi';
import { PROJECTS_URI, STUDIES_URI } from '../operationalStudiesConsts';

type Props = {
  editionMode?: boolean;
  study?: StudyResult;
  getStudy?: (v: boolean) => void;
};

type SelectOptions = { key: string | null; value: string }[];

export default function AddOrEditStudyModal({ editionMode, study, getStudy }: Props) {
  const { t } = useTranslation('operationalStudies/study');
  const { closeModal } = useContext(ModalContext);
  const [currentStudy, setCurrentStudy] = useState<StudyResult | undefined>(study);
  const [displayErrors, setDisplayErrors] = useState(false);
  const emptyOptions = [{ key: null, value: t('nothingSelected') }];
  const [studyCategories, setStudyCategories] = useState<SelectOptions>(emptyOptions);
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
      /* empty */
    }
  };

  const formatDateForInput = (date: string | null) => (date === null ? '' : date.substr(0, 10));

  const removeTag = (idx: number) => {
    if (currentStudy?.tags) {
      const newTags: string[] = Array.from(currentStudy.tags);
      newTags.splice(idx, 1);
      setCurrentStudy({ ...currentStudy, tags: newTags });
    }
  };

  const addTag = (tag: string) => {
    if (currentStudy?.tags) {
      const newTags: string[] = Array.from(currentStudy.tags);
      newTags.push(tag);
      setCurrentStudy({ ...currentStudy, tags: newTags });
    }
  };

  const createStudy = async () => {
    if (!currentStudy?.name) {
      setDisplayErrors(true);
    } else {
      try {
        const result = await post(`${rootURI}`, currentStudy);
        dispatch(updateStudyID(result.id));
        navigate('/operational-studies/study');
        closeModal();
      } catch (error) {
        console.error(error);
      }
    }
  };

  const updateStudy = async () => {
    if (!currentStudy?.name) {
      setDisplayErrors(true);
    } else if (study) {
      try {
        await patch(`${rootURI}${study.id}/`, currentStudy);
        if (getStudy) getStudy(true);
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
    createSelectOptions(
      'studyCategories',
      `/projects/${currentStudy?.id}/study_types/`,
      setStudyCategories
    );
    createSelectOptions(
      'studyStates',
      `/projects/${currentStudy?.id}/study_states/`,
      setStudyStates
    );
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
            value={currentStudy?.name}
            onChange={(e) => setCurrentStudy({ ...currentStudy, name: e.target.value })}
            isInvalid={displayErrors && !currentStudy?.name}
            errorMsg={displayErrors && !currentStudy?.name ? t('studyNameMissing') : undefined}
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
                      key: currentStudy?.study_type,
                      value: t(`studyCategories.${currentStudy?.study_type || 'nothingSelected'}`),
                    }}
                    options={studyCategories}
                    onChange={(e) => setCurrentStudy({ ...currentStudy, study_type: e.key })}
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
                      key: currentStudy?.state,
                      value: t(`studyStates.${currentStudy?.state || 'nothingSelected'}`),
                    }}
                    options={studyStates}
                    onChange={(e) => setCurrentStudy({ ...currentStudy, state: e.key })}
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
                value={currentStudy?.description}
                onChange={(e) => setCurrentStudy({ ...currentStudy, description: e.target.value })}
              />
            </div>
          </div>
          <div className="col-lg-4">
            {currentStudy?.start_date_study && (
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
                value={formatDateForInput(currentStudy.start_date_study)}
                onChange={(e) =>
                  setCurrentStudy({ ...currentStudy, start_date_study: e.target.value })
                }
              />
            )}
            {currentStudy?.expected_end_date_study && (
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
                value={formatDateForInput(currentStudy?.expected_end_date_study)}
                onChange={(e) =>
                  setCurrentStudy({ ...currentStudy, expected_end_date_study: e.target.value })
                }
              />
            )}
            {currentStudy?.actual_end_date_study && (
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
                value={formatDateForInput(currentStudy.actual_end_date_study)}
                onChange={(e) =>
                  setCurrentStudy({ ...currentStudy, actual_end_date_study: e.target.value })
                }
              />
            )}
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
              value={currentStudy?.service_code}
              onChange={(e) => setCurrentStudy({ ...currentStudy, service_code: e.target.value })}
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
              value={currentStudy?.business_code}
              onChange={(e) => setCurrentStudy({ ...currentStudy, business_code: e.target.value })}
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
              value={currentStudy?.budget}
              onChange={(e) => setCurrentStudy({ ...currentStudy, budget: +e.target.value })}
            />
          </div>
        </div>
        <ChipsSNCF
          addTag={addTag}
          tags={currentStudy?.tags}
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
            <button className="btn btn-warning" type="button" onClick={updateStudy}>
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
