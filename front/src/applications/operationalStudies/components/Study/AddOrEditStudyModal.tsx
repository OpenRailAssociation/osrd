import { useContext, useEffect, useMemo, useRef, useState } from 'react';

import { Note, Pencil, Trash } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';
import { FaPlus, FaTasks } from 'react-icons/fa';
import { MdBusinessCenter, MdTitle } from 'react-icons/md';
import { RiCalendarLine, RiMoneyEuroCircleLine, RiQuestionLine } from 'react-icons/ri';
import { useNavigate, useParams } from 'react-router-dom';

import {
  STUDY_STATES,
  studyStates,
  STUDY_TYPES,
} from 'applications/operationalStudies/views/Study/consts';
import studyLogo from 'assets/pictures/views/studies.svg';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import type { ScenarioWithDetails, StudyCreateForm } from 'common/api/osrdEditoastApi';
import ChipsSNCF from 'common/BootstrapSNCF/ChipsSNCF';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { ConfirmModal, useModal } from 'common/BootstrapSNCF/ModalSNCF';
import ModalBodySNCF from 'common/BootstrapSNCF/ModalSNCF/ModalBodySNCF';
import ModalFooterSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalFooterSNCF';
import ModalHeaderSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalHeaderSNCF';
import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import SelectImprovedSNCF from 'common/BootstrapSNCF/SelectImprovedSNCF';
import TextareaSNCF from 'common/BootstrapSNCF/TextareaSNCF';
import DeleteItemsModal from 'modules/project/components/DeleteItemsModal';
import { cleanScenarioLocalStorage } from 'modules/scenario/helpers/utils';
import { setFailure, setSuccess } from 'reducers/main';
import { useAppDispatch } from 'store';
import { castErrorToFailure } from 'utils/error';
import useInputChange from 'utils/hooks/useInputChange';
import useModalFocusTrap from 'utils/hooks/useModalFocusTrap';
import useOutsideClick from 'utils/hooks/useOutsideClick';

import { createSelectOptions, checkStudyFields } from './utils';

export type StudyForm = StudyCreateForm & {
  id?: number;
};

type AddOrEditStudyModalProps = {
  editionMode?: boolean;
  study?: StudyForm;
  scenarios?: ScenarioWithDetails[];
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
  state: STUDY_STATES.started,
  study_type: '',
  tags: [],
};

const AddOrEditStudyModal = ({ editionMode, study, scenarios }: AddOrEditStudyModalProps) => {
  const { t } = useTranslation(['operational-studies', 'translation']);
  const { openModal } = useModal();
  const { closeModal, isOpen } = useContext(ModalContext);
  const [currentStudy, setCurrentStudy] = useState<StudyForm>(study || emptyStudy);
  const [displayErrors, setDisplayErrors] = useState(false);
  const { projectId } = useParams() as StudyParams;
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const [createStudies, { error: createStudyError }] =
    osrdEditoastApi.endpoints.postProjectsByProjectIdStudies.useMutation();
  const [patchStudies, { error: patchStudyError }] =
    osrdEditoastApi.endpoints.patchProjectsByProjectIdStudiesAndStudyId.useMutation();
  const [deleteStudies, { error: deleteStudyError }] =
    osrdEditoastApi.endpoints.deleteProjectsByProjectIdStudiesAndStudyId.useMutation();

  const studyStateOptions = createSelectOptions(t, studyStates);

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

  const invalidFields = checkStudyFields(currentStudy);
  const hasErrors = Object.values(invalidFields).some((field) => field);

  const createStudy = () => {
    if (hasErrors) {
      setDisplayErrors(true);
    } else {
      createStudies({
        projectId: +projectId,
        studyCreateForm: currentStudy,
      })
        .unwrap()
        .then((createdStudy) => {
          navigate(`projects/${projectId}/studies/${createdStudy.id}`);
          closeModal();
        });
    }
  };

  const updateStudy = () => {
    if (hasErrors) {
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
              title: t('study.studyUpdated'),
              text: t('study.studyUpdatedDetails', { name: study.name }),
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
          if (scenarios) {
            // For each scenario in the study, clean the local storage if a manchette is saved
            scenarios.forEach((scenario) => {
              cleanScenarioLocalStorage(scenario.timetable_id);
            });
          }

          dispatch(
            setSuccess({
              title: t('study.studyDeleted'),
              text: t('study.studyDeletedDetails', { name: study.name }),
            })
          );
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

  let maxStudyStartDate = currentStudy.expected_end_date;
  if (
    maxStudyStartDate &&
    currentStudy.actual_end_date &&
    currentStudy.actual_end_date < maxStudyStartDate
  ) {
    maxStudyStartDate = currentStudy.actual_end_date;
  }

  return (
    <div data-testid="study-edition-modal" className="study-edition-modal" ref={modalRef}>
      {clickedOutside && (
        <div className="confirm-modal">
          <div className="confirm-modal-content">
            <ConfirmModal
              title={t('common.leaveEditionMode', { ns: 'translation' })}
              onCancel={resetClickedOutside}
              withCloseButton={false}
            />
          </div>
        </div>
      )}
      <ModalHeaderSNCF withCloseButton withBorderBottom>
        <h1 className="study-edition-modal-title">
          <img src={studyLogo} alt="Study Logo" />
          {editionMode ? t('study.studyModificationTitle') : t('study.studyCreationTitle')}
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
                <span className="font-weight-bold">{t('study.studyName')}</span>
              </div>
            }
            value={currentStudy?.name}
            onChange={(e) => handleStudyInputChange('name', e.target.value)}
            isInvalid={displayErrors && invalidFields.name}
            errorMsg={t('study.studyNameInvalid')}
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
                        {t('study.studyType')}
                      </div>
                    }
                    value={{
                      id: currentStudy.study_type ?? undefined,
                      label: t(
                        `study.studyCategories.${currentStudy.study_type || 'nothingSelected'}`
                      ).toString(),
                    }}
                    options={STUDY_TYPES.map((studyType) => ({
                      id: studyType === 'nothingSelected' ? '' : studyType,
                      label: t(`study.studyCategories.${studyType}`),
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
                        {t('study.studyState')}
                      </div>
                    }
                    value={{
                      id: currentStudy.state,
                      label: t(`study.studyStates.${currentStudy.state}`).toString(),
                    }}
                    options={studyStateOptions}
                    onChange={(e) => handleStudyInputChange('state', e?.id)}
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
                    {t('study.studyDescription')}
                  </div>
                }
                value={currentStudy.description ?? undefined}
                onChange={(e) => handleStudyInputChange('description', e.target.value)}
                placeholder={t('study.studyDescriptionPlaceholder')}
                isInvalid={displayErrors && invalidFields.description}
                errorMsg={t('study.studyDescriptionInvalid')}
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
                  {t('study.studyStartDate')}
                </div>
              }
              value={currentStudy?.start_date || ''}
              onChange={(e) => handleStudyInputChange('start_date', e.target.value || null)}
              max={maxStudyStartDate || ''}
            />
            <InputSNCF
              id="studyInputExpectedEndDate"
              type="date"
              name="studyInputExpectedEndDate"
              label={
                <div className="d-flex align-items-center">
                  <span className="mr-2 text-warning">
                    <RiCalendarLine />
                  </span>
                  {t('study.studyExpectedEndDate')}
                </div>
              }
              value={currentStudy?.expected_end_date || ''}
              onChange={(e) => handleStudyInputChange('expected_end_date', e.target.value || null)}
              min={currentStudy.start_date || ''}
              isInvalid={!isExpectedEndDateValid}
            />
            <InputSNCF
              id="studyInputRealEndDate"
              type="date"
              name="studyInputRealEndDate"
              label={
                <div className="d-flex align-items-center">
                  <span className="mr-2 text-danger">
                    <RiCalendarLine />
                  </span>
                  {t('study.studyRealEndDate')}
                </div>
              }
              value={currentStudy?.actual_end_date || ''}
              onChange={(e) => handleStudyInputChange('actual_end_date', e.target.value || null)}
              min={currentStudy.start_date || ''}
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
                  {t('study.study-service-code')}
                </div>
              }
              value={currentStudy?.service_code || ''}
              onChange={(e) => handleStudyInputChange('service_code', e.target.value)}
              isInvalid={displayErrors && invalidFields.service_code}
              errorMsg={t('study.studyServiceCodeInvalid')}
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
                  {t('study.study-business-code')}
                </div>
              }
              value={currentStudy?.business_code || ''}
              onChange={(e) => handleStudyInputChange('business_code', e.target.value)}
              isInvalid={displayErrors && invalidFields.business_code}
              errorMsg={t('study.studyBusinessCodeInvalid')}
            />
          </div>
          <div className="col-lg-4">
            <InputSNCF
              id="studyInputBudget"
              type="number"
              name="studyInputBudget"
              unit="€"
              min={0}
              label={
                <div className="d-flex align-items-center">
                  <span className="mr-2">
                    <RiMoneyEuroCircleLine />
                  </span>
                  {t('study.budget')}
                </div>
              }
              value={
                currentStudy.budget !== undefined &&
                currentStudy.budget !== null &&
                currentStudy.budget >= 0
                  ? currentStudy.budget
                  : ''
              }
              onChange={(e) =>
                handleStudyInputChange(
                  'budget',
                  e.target.value !== '' && +e.target.value >= 0 ? +e.target.value : null
                )
              }
              textRight
              isInvalid={displayErrors && invalidFields.budget}
              errorMsg={t('study.studyBudgetInvalid')}
            />
          </div>
        </div>
        <ChipsSNCF
          addTag={addTag}
          tags={currentStudy?.tags || []}
          removeTag={removeTag}
          title={t('study.studyTags')}
          color="primary"
        />
      </ModalBodySNCF>
      <ModalFooterSNCF>
        <div className="d-flex justify-content-end w-100">
          {editionMode && (
            <button
              data-testid="delete-study"
              className="btn btn-outline-danger mr-auto"
              type="button"
              onClick={() =>
                openModal(
                  <DeleteItemsModal
                    handleDeleteItems={deleteStudy}
                    translationKey={t('study.confirm-delete', { count: 1 })}
                  />,
                  'sm'
                )
              }
            >
              <span className="mr-2">
                <Trash />
              </span>
              {t('study.studyDeleteButton')}
            </button>
          )}
          <button className="btn btn-secondary mr-2" type="button" onClick={closeModal}>
            {t('study.studyCancel')}
          </button>
          {editionMode ? (
            <button
              data-testid="update-study"
              className="btn btn-warning"
              type="button"
              onClick={updateStudy}
              disabled={!isExpectedEndDateValid || !isActualEndDateValid}
            >
              <span className="mr-2">
                <Pencil />
              </span>
              {t('study.studyModifyButton')}
            </button>
          ) : (
            <button
              data-testid="create-study"
              className="btn btn-primary"
              type="button"
              onClick={createStudy}
              disabled={!isExpectedEndDateValid || !isActualEndDateValid}
            >
              <span className="mr-2">
                <FaPlus />
              </span>
              {t('study.studyCreateButton')}
            </button>
          )}
        </div>
      </ModalFooterSNCF>
    </div>
  );
};

export default AddOrEditStudyModal;
