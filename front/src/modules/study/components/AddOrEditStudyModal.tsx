import React, { useContext, useEffect, useMemo, useState } from 'react';
import studyLogo from 'assets/pictures/views/studies.svg';
import ChipsSNCF from 'common/BootstrapSNCF/ChipsSNCF';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import ModalBodySNCF from 'common/BootstrapSNCF/ModalSNCF/ModalBodySNCF';
import ModalFooterSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalFooterSNCF';
import ModalHeaderSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalHeaderSNCF';
import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import SelectImprovedSNCF from 'common/BootstrapSNCF/SelectImprovedSNCF';
import TextareaSNCF from 'common/BootstrapSNCF/TextareaSNCF';
import { useTranslation } from 'react-i18next';
import { FaPencilAlt, FaPlus, FaTasks, FaTrash } from 'react-icons/fa';
import { GoNote } from 'react-icons/go';
import { MdBusinessCenter, MdTitle } from 'react-icons/md';
import { RiCalendarLine, RiMoneyEuroCircleLine, RiQuestionLine } from 'react-icons/ri';
import { useDispatch } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import { setFailure, setSuccess } from 'reducers/main';
import { updateStudyID } from 'reducers/osrdconf';
import { StudyCreateForm, StudyWithScenarios, osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { studyStates, studyTypes } from 'applications/operationalStudies/consts';
import { formatDateForInput, getEarliestDate } from 'utils/date';
import { createSelectOptions } from '../utils';

interface StudyForm extends StudyCreateForm {
  id?: number;
}

type Props = {
  editionMode?: boolean;
  study?: StudyWithScenarios;
};

type StudyParams = {
  projectId: string;
};

const emptyStudy: StudyForm = { name: '', tags: [] };

export default function AddOrEditStudyModal({ editionMode, study }: Props) {
  const { t } = useTranslation('operationalStudies/study');
  const { closeModal } = useContext(ModalContext);
  const [currentStudy, setCurrentStudy] = useState<StudyForm>((study as StudyForm) || emptyStudy);
  const [displayErrors, setDisplayErrors] = useState(false);
  const { projectId } = useParams() as StudyParams;
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [createStudies, { isError: isCreateStudyError }] =
    osrdEditoastApi.usePostProjectsByProjectIdStudiesMutation();
  const [patchStudies, { isError: isPatchStudyError }] =
    osrdEditoastApi.usePatchProjectsByProjectIdStudiesAndStudyIdMutation();
  const [deleteStudies, { isError: isDeleteStudyError }] =
    osrdEditoastApi.useDeleteProjectsByProjectIdStudiesAndStudyIdMutation();

  const studyStateOptions = createSelectOptions('studyStates', studyStates);

  const studyCategoriesOptions = createSelectOptions('studyCategories', studyTypes);

  const removeTag = (idx: number) => {
    const newTags = [...(currentStudy.tags || [])];
    newTags.splice(idx, 1);
    setCurrentStudy({ ...currentStudy, tags: newTags });
  };

  const addTag = (tag: string) => {
    setCurrentStudy({ ...currentStudy, tags: [...(currentStudy.tags || []), tag] });
  };

  const createStudy = () => {
    if (!currentStudy?.name) {
      setDisplayErrors(true);
    } else {
      createStudies({
        projectId: +projectId,
        studyCreateForm: currentStudy,
      })
        .unwrap()
        .then((createdStudy) => {
          dispatch(updateStudyID(createdStudy.id));
          navigate(`projects/${projectId}/studies/${createdStudy.id}`);
          closeModal();
        });
    }
  };

  const updateStudy = () => {
    if (!currentStudy?.name) {
      setDisplayErrors(true);
    } else if (study?.id && projectId) {
      patchStudies({
        projectId: +projectId,
        studyId: study.id,
        studyPatchForm: currentStudy,
      })
        .unwrap()
        .then(() => {
          dispatch(
            setSuccess({
              title: t('studyUpdated'),
              text: t('studyUpdatedDetails', { name: study.name }),
            })
          );
          closeModal();
        });
    }
  };

  const deleteStudy = () => {
    if (study?.id && projectId) {
      deleteStudies({
        projectId: +projectId,
        studyId: study.id,
      })
        .unwrap()
        .then(() => {
          dispatch(
            setSuccess({
              title: t('studyDeleted'),
              text: t('studyDeletedDetails', { name: study.name }),
            })
          );
          dispatch(updateStudyID(undefined));
          navigate(`projects/${projectId}/`);
          closeModal();
        });
    }
  };

  useEffect(() => {
    if (isCreateStudyError || isPatchStudyError || isDeleteStudyError) {
      dispatch(
        setFailure({
          name: t('errorHappened'),
          message: t('errorHappened'),
        })
      );
    }
  }, [isCreateStudyError, isPatchStudyError, isDeleteStudyError]);

  const { isExpectedEndDateValid, isActualEndDateValid } = useMemo(() => {
    const startDate = currentStudy?.start_date;
    const expectedEndDate = currentStudy?.expected_end_date;
    const actualEndDate = currentStudy?.actual_end_date;
    const expectedEndDateValid = !(startDate && expectedEndDate && startDate > expectedEndDate);
    const actualEndDateValid = !(startDate && actualEndDate && startDate > actualEndDate);
    return {
      isExpectedEndDateValid: expectedEndDateValid,
      isActualEndDateValid: actualEndDateValid,
    };
  }, [currentStudy?.start_date, currentStudy?.expected_end_date, currentStudy?.actual_end_date]);

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
                    label={
                      <div className="d-flex align-items-center">
                        <span className="mr-2">
                          <RiQuestionLine />
                        </span>
                        {t('studyType')}
                      </div>
                    }
                    value={{
                      id: currentStudy.study_type,
                      label: t(
                        `studyCategories.${currentStudy.study_type || 'nothingSelected'}`
                      ).toString(),
                    }}
                    options={studyCategoriesOptions}
                    onChange={(e) =>
                      setCurrentStudy({
                        ...currentStudy,
                        study_type: e?.id as StudyForm['study_type'],
                      })
                    }
                    data-testid="studyType"
                  />
                </div>
              </div>
              <div className="col-xl-6">
                <div className="study-edition-modal-state mb-2">
                  <SelectImprovedSNCF
                    label={
                      <div className="d-flex align-items-center">
                        <span className="mr-2">
                          <FaTasks />
                        </span>
                        {t('studyState')}
                      </div>
                    }
                    value={{
                      id: currentStudy.state,
                      label: t(`studyStates.${currentStudy.state || 'nothingSelected'}`).toString(),
                    }}
                    options={studyStateOptions}
                    onChange={(e) =>
                      setCurrentStudy({
                        ...currentStudy,
                        state: e?.id as StudyForm['state'],
                      })
                    }
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
              value={formatDateForInput(currentStudy?.start_date)}
              onChange={(e) =>
                setCurrentStudy({ ...currentStudy, start_date: e.target.value || null })
              }
              max={getEarliestDate(currentStudy?.expected_end_date, currentStudy?.actual_end_date)}
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
              value={formatDateForInput(currentStudy?.expected_end_date)}
              onChange={(e) =>
                setCurrentStudy({ ...currentStudy, expected_end_date: e.target.value || null })
              }
              min={formatDateForInput(currentStudy.start_date)}
              isInvalid={!isExpectedEndDateValid}
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
              value={formatDateForInput(currentStudy?.actual_end_date)}
              onChange={(e) =>
                setCurrentStudy({ ...currentStudy, actual_end_date: e.target.value || null })
              }
              min={formatDateForInput(currentStudy.start_date)}
              isInvalid={!isActualEndDateValid}
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
              value={currentStudy?.service_code || ''}
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
              value={currentStudy?.business_code || ''}
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
              value={currentStudy.budget !== undefined ? currentStudy.budget : ''}
              onChange={(e) =>
                setCurrentStudy({
                  ...currentStudy,
                  budget: e.target.value !== '' ? +e.target.value : undefined,
                })
              }
              textRight
            />
          </div>
        </div>
        <ChipsSNCF
          addTag={addTag}
          tags={currentStudy?.tags || []}
          removeTag={removeTag}
          title={t('studyTags')}
          color="primary"
        />
      </ModalBodySNCF>
      <ModalFooterSNCF>
        <div className="d-flex justify-content-end w-100">
          {editionMode && (
            <button
              data-testid="deleteStudy"
              className="btn btn-outline-danger mr-auto"
              type="button"
              onClick={deleteStudy}
            >
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
            <button
              data-testid="updateStudy"
              className="btn btn-warning"
              type="button"
              onClick={updateStudy}
              disabled={!isExpectedEndDateValid || !isActualEndDateValid}
            >
              <span className="mr-2">
                <FaPencilAlt />
              </span>
              {t('studyModifyButton')}
            </button>
          ) : (
            <button
              data-testid="createStudy"
              className="btn btn-primary"
              type="button"
              onClick={createStudy}
              disabled={!isExpectedEndDateValid || !isActualEndDateValid}
            >
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
