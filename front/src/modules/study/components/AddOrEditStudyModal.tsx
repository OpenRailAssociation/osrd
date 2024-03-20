import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';

import { Note, Pencil, Trash } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';
import { FaPlus, FaTasks } from 'react-icons/fa';
import { MdBusinessCenter, MdTitle } from 'react-icons/md';
import { RiCalendarLine, RiMoneyEuroCircleLine, RiQuestionLine } from 'react-icons/ri';
import { useNavigate, useParams } from 'react-router-dom';

import { STUDY_STATES, STUDY_TYPES } from 'applications/operationalStudies/consts';
import studyLogo from 'assets/pictures/views/studies.svg';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import type { StudyCreateForm } from 'common/api/osrdEditoastApi';
import ChipsSNCF from 'common/BootstrapSNCF/ChipsSNCF';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { ConfirmModal } from 'common/BootstrapSNCF/ModalSNCF';
import ModalBodySNCF from 'common/BootstrapSNCF/ModalSNCF/ModalBodySNCF';
import ModalFooterSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalFooterSNCF';
import ModalHeaderSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalHeaderSNCF';
import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import SelectImprovedSNCF from 'common/BootstrapSNCF/SelectImprovedSNCF';
import TextareaSNCF from 'common/BootstrapSNCF/TextareaSNCF';
import { useOsrdConfActions } from 'common/osrdContext';
import { setFailure, setSuccess } from 'reducers/main';
import { useAppDispatch } from 'store';
import { formatDateForInput, getEarliestDate } from 'utils/date';
import { castErrorToFailure } from 'utils/error';
import useInputChange from 'utils/hooks/useInputChange';
import useModalFocusTrap from 'utils/hooks/useModalFocusTrap';
import useOutsideClick from 'utils/hooks/useOutsideClick';

export interface StudyForm extends StudyCreateForm {
  id?: number;
}

type Props = {
  editionMode?: boolean;
  study?: StudyForm;
};

type StudyParams = {
  projectId: string;
};

const emptyStudy: StudyForm = {
  actual_end_date: null,
  budget: null,
  business_code: '',
  description: '',
  expected_end_date: null,
  name: '',
  service_code: '',
  start_date: null,
  state: 'started',
  study_type: '',
  tags: [],
};

export default function AddOrEditStudyModal({ editionMode, study }: Props) {
  const { t } = useTranslation(['operationalStudies/study', 'translation']);
  const { closeModal, isOpen } = useContext(ModalContext);
  const [currentStudy, setCurrentStudy] = useState<StudyForm>(study || emptyStudy);
  const [displayErrors, setDisplayErrors] = useState(false);
  const { projectId } = useParams() as StudyParams;
  const { updateStudyID } = useOsrdConfActions();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const [createStudies, { error: createStudyError }] =
    osrdEditoastApi.usePostProjectsByProjectIdStudiesMutation();
  const [patchStudies, { error: patchStudyError }] =
    osrdEditoastApi.usePatchProjectsByProjectIdStudiesAndStudyIdMutation();
  const [deleteStudies, { error: deleteStudyError }] =
    osrdEditoastApi.useDeleteProjectsByProjectIdStudiesAndStudyIdMutation();

  const initialValuesRef = useRef<StudyForm | null>(null);

  const modalRef = useRef<HTMLDivElement | null>(null);

  const { clickedOutside, setHasChanges, resetClickedOutside } = useOutsideClick(
    modalRef,
    closeModal,
    isOpen
  );

  const handleStudyInputChange = useInputChange(initialValuesRef, setCurrentStudy, setHasChanges);

  const removeTag = (idx: number) => {
    const newTags = [...(currentStudy.tags || [])];
    newTags.splice(idx, 1);
    setCurrentStudy({ ...currentStudy, tags: newTags });
    handleStudyInputChange('tags', newTags);
  };

  const addTag = (tag: string) => {
    const updatedTags = [...(currentStudy.tags || []), tag];
    setCurrentStudy({ ...currentStudy, tags: updatedTags });
    handleStudyInputChange('tags', updatedTags);
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

  useEffect(() => {
    if (study) {
      initialValuesRef.current = { ...study };
    } else {
      initialValuesRef.current = { ...emptyStudy };
    }
  }, [study]);

  /* Notify API errors */
  useEffect(() => {
    if (createStudyError) dispatch(setFailure(castErrorToFailure(createStudyError)));
  }, [createStudyError]);
  useEffect(() => {
    if (patchStudyError) dispatch(setFailure(castErrorToFailure(patchStudyError)));
  }, [patchStudyError]);
  useEffect(() => {
    if (deleteStudyError) dispatch(setFailure(castErrorToFailure(deleteStudyError)));
  }, [deleteStudyError]);

  useModalFocusTrap(modalRef, closeModal);

  return (
    <div className="study-edition-modal" ref={modalRef}>
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
            focus
            label={
              <div className="d-flex align-items-center">
                <span className="mr-2">
                  <MdTitle />
                </span>
                <span className="font-weight-bold">{t('studyName')}</span>
              </div>
            }
            value={currentStudy?.name}
            onChange={(e) => handleStudyInputChange('name', e.target.value)}
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
                    options={STUDY_TYPES.map((studyType) => ({
                      id: studyType === 'nothingSelected' ? '' : studyType,
                      label: t(`studyCategories.${studyType}`),
                    }))}
                    onChange={(e) => {
                      handleStudyInputChange('study_type', e.id);
                    }}
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
                      label: t(`studyStates.${currentStudy.state}`).toString(),
                    }}
                    options={STUDY_STATES.map((studyState) => ({
                      id: studyState,
                      label: t(`studyStates.${currentStudy.state}`),
                    }))}
                    onChange={(e) => handleStudyInputChange('state', e.id)}
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
                      <Note />
                    </span>
                    {t('studyDescription')}
                  </div>
                }
                value={currentStudy?.description}
                onChange={(e) => handleStudyInputChange('description', e.target.value)}
                placeholder={t('studyDescriptionPlaceholder')}
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
              onChange={(e) => handleStudyInputChange('start_date', e.target.value || null)}
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
              onChange={(e) => handleStudyInputChange('expected_end_date', e.target.value || null)}
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
              onChange={(e) => handleStudyInputChange('actual_end_date', e.target.value || null)}
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
              onChange={(e) => handleStudyInputChange('service_code', e.target.value)}
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
              onChange={(e) => handleStudyInputChange('business_code', e.target.value)}
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
              value={
                currentStudy.budget !== undefined && currentStudy.budget !== null
                  ? currentStudy.budget
                  : ''
              }
              onChange={(e) =>
                handleStudyInputChange('budget', e.target.value !== '' ? +e.target.value : null)
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
                <Trash />
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
                <Pencil />
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
