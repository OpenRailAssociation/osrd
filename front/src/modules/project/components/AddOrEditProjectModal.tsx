import React, { useContext, useEffect, useRef, useState } from 'react';

import { Pencil, Trash } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';
import { BiTargetLock } from 'react-icons/bi';
import { FaPlus } from 'react-icons/fa';
import { MdBusinessCenter, MdDescription, MdTitle } from 'react-icons/md';
import { RiMoneyEuroCircleLine } from 'react-icons/ri';
import ReactMarkdown from 'react-markdown';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import remarkGfm from 'remark-gfm';

import PictureUploader from 'applications/operationalStudies/components/Project/PictureUploader';
import { postDocument } from 'common/api/documentApi';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import type { ProjectWithStudies, ProjectCreateForm } from 'common/api/osrdEditoastApi';
import ChipsSNCF from 'common/BootstrapSNCF/ChipsSNCF';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { ConfirmModal } from 'common/BootstrapSNCF/ModalSNCF';
import ModalBodySNCF from 'common/BootstrapSNCF/ModalSNCF/ModalBodySNCF';
import ModalFooterSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalFooterSNCF';
import ModalHeaderSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalHeaderSNCF';
import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import TextareaSNCF from 'common/BootstrapSNCF/TextareaSNCF';
import { useOsrdConfActions } from 'common/osrdContext';
import { setFailure, setSuccess } from 'reducers/main';
import { getUserSafeWord } from 'reducers/user/userSelectors';
import { useAppDispatch } from 'store';
import { castErrorToFailure } from 'utils/error';
import { useDebounce } from 'utils/helpers';
import useInputChange from 'utils/hooks/useInputChange';
import useModalFocusTrap from 'utils/hooks/useModalFocusTrap';
import useOutsideClick from 'utils/hooks/useOutsideClick';

const emptyProject: ProjectCreateForm = {
  budget: undefined,
  description: '',
  funders: '',
  image: null,
  name: '',
  objectives: '',
  tags: [],
};

interface ProjectForm extends ProjectCreateForm {
  id?: number;
}

type AddOrEditProjectModalProps = {
  editionMode?: boolean;
  project?: ProjectWithStudies;
  getProject?: (v: boolean) => void;
};

export default function AddOrEditProjectModal({
  editionMode,
  project,
  getProject,
}: AddOrEditProjectModalProps) {
  const { t } = useTranslation(['operationalStudies/project', 'translation']);
  const { closeModal, isOpen } = useContext(ModalContext);
  const [currentProject, setCurrentProject] = useState<ProjectForm>(project || emptyProject);
  const [tempProjectImage, setTempProjectImage] = useState<Blob | null | undefined>();

  const [displayErrors, setDisplayErrors] = useState(false);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const safeWord = useSelector(getUserSafeWord);

  const [postProject] = osrdEditoastApi.endpoints.postProjects.useMutation();
  const [patchProject] = osrdEditoastApi.endpoints.patchProjectsByProjectId.useMutation();
  const [deleteProject] = osrdEditoastApi.endpoints.deleteProjectsByProjectId.useMutation();

  const { updateProjectID } = useOsrdConfActions();

  const initialValuesRef = useRef<ProjectForm | null>(null);

  const modalRef = useRef<HTMLDivElement | null>(null);

  const { clickedOutside, setHasChanges, resetClickedOutside } = useOutsideClick(
    modalRef,
    closeModal,
    isOpen
  );

  const handleProjectInputChange = useInputChange(
    initialValuesRef,
    setCurrentProject,
    setHasChanges
  );

  const removeTag = (idx: number) => {
    if (!currentProject.tags) return;
    const newTags = Array.from(currentProject.tags);
    newTags.splice(idx, 1);
    setCurrentProject({ ...currentProject, tags: newTags });
    handleProjectInputChange('tags', newTags);
  };

  const addTag = (tag: string) => {
    if (!currentProject.tags) return;
    const newTags = Array.from(currentProject.tags);
    newTags.push(tag);
    if (currentProject) setCurrentProject({ ...currentProject, tags: newTags });
    handleProjectInputChange('tags', newTags);
  };

  const uploadImage = async (image: Blob): Promise<number | null> => {
    try {
      const imageId = await postDocument(image as Blob);
      return imageId;
    } catch (error) {
      dispatch(
        setFailure(castErrorToFailure(error, { name: t('error.unableToPostDocumentTitle') }))
      );
      return null;
    }
  };

  const createProject = async () => {
    if (currentProject.name === '') {
      setDisplayErrors(true);
    } else {
      try {
        if (tempProjectImage) {
          const imageId = await uploadImage(tempProjectImage as Blob);
          if (imageId) currentProject.image = imageId;
        }
        const request = postProject({
          projectCreateForm: currentProject,
        });
        request
          .unwrap()
          .then((projectCreated) => {
            dispatch(updateProjectID(projectCreated.id));
            navigate(`/operational-studies/projects/${projectCreated.id}`);
            closeModal();
          })
          .catch((error) => {
            dispatch(
              setFailure(
                castErrorToFailure(error, {
                  name: t('error.unableToCreateProjectTitle'),
                })
              )
            );
            console.error('Create project error', error);
          });
      } catch (error) {
        console.error('Create project error', error);
      }
    }
  };

  const updateProject = async () => {
    if (currentProject.name === '') {
      setDisplayErrors(true);
    } else if (project && currentProject.id) {
      try {
        let imageId = currentProject.image;

        if (tempProjectImage) {
          imageId = await uploadImage(tempProjectImage as Blob);
          // if the upload of the new image fails, keep the old one
          if (!imageId && currentProject.image) {
            imageId = currentProject.image;
          }
        } else if (tempProjectImage === null) {
          imageId = null;
          setTempProjectImage(imageId);
        }

        const editedProject = { ...currentProject, image: imageId };
        setCurrentProject(editedProject);
        const request = patchProject({
          projectId: currentProject.id,
          projectPatchForm: editedProject,
        });
        request
          .unwrap()
          .then(() => {
            if (getProject) getProject(true);
            closeModal();
          })
          .catch((error) => {
            dispatch(
              setFailure(
                castErrorToFailure(error, {
                  name: t('error.unableToUpdateProjectTitle'),
                })
              )
            );
            console.error('Patch project error', error);
          });
      } catch (error) {
        console.error('Update project error', error);
      }
    }
  };

  const removeProject = async () => {
    if (project) {
      await deleteProject({ projectId: project.id })
        .unwrap()
        .then(() => {
          dispatch(updateProjectID(undefined));
          navigate(`/operational-studies/projects/`);
          closeModal();
          dispatch(
            setSuccess({
              title: t('projectDeleted'),
              text: t('projectDeletedDetails', { name: project.name }),
            })
          );
        })
        .catch((e) => {
          dispatch(
            setFailure(
              castErrorToFailure(e, {
                name: t('error.unableToDeleteProject'),
              })
            )
          );
        });
    }
  };

  const debouncedObjectives = useDebounce(currentProject.objectives, 500);

  useEffect(() => {
    if (project) {
      initialValuesRef.current = { ...project };
    } else {
      initialValuesRef.current = { ...emptyProject };
    }
  }, [project]);

  useEffect(() => {
    if (safeWord !== '') {
      addTag(safeWord);
    }
  }, [safeWord]);

  useModalFocusTrap(modalRef, closeModal);

  return (
    <div className="project-edition-modal" ref={modalRef}>
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
        <h1 className="project-edition-modal-title">
          {editionMode ? t('projectModificationTitle') : t('projectCreationTitle')}
        </h1>
      </ModalHeaderSNCF>
      <ModalBodySNCF>
        <div className="row mb-3">
          <div className="col-lg-5 col-md-6">
            <div className="project-edition-modal-picture">
              <PictureUploader
                image={currentProject.image}
                setTempProjectImage={setTempProjectImage}
                tempProjectImage={tempProjectImage}
              />
            </div>
          </div>
          <div className="col-lg-7 col-md-6">
            <div className="project-edition-modal-name">
              <InputSNCF
                id="projectInputName"
                type="text"
                name="projectInputName"
                data-testid="projectInputName"
                focus
                label={
                  <div className="d-flex align-items-center">
                    <span className="mr-2">
                      <MdTitle />
                    </span>
                    <span className="font-weight-bold">{t('projectName')}</span>
                  </div>
                }
                value={currentProject.name}
                onChange={(e) => handleProjectInputChange('name', e.target.value)}
                isInvalid={displayErrors && !currentProject.name}
                errorMsg={
                  displayErrors && !currentProject.name ? t('projectNameMissing') : undefined
                }
              />
            </div>
            <div className="project-edition-modal-description">
              <TextareaSNCF
                id="projectDescription"
                label={
                  <div className="d-flex align-items-center">
                    <span className="mr-2">
                      <MdDescription />
                    </span>
                    {t('projectDescription')}
                  </div>
                }
                value={currentProject.description}
                onChange={(e) => handleProjectInputChange('description', e.target.value)}
                placeholder={t('projectDescriptionPlaceholder')}
                rows={3}
              />
            </div>
          </div>
        </div>
        <div className="row mb-3">
          <div className="col-lg-5">
            <div className="project-edition-modal-objectives">
              <TextareaSNCF
                id="projectObjectives"
                label={
                  <div className="d-flex align-items-center">
                    <span className="mr-2">
                      <BiTargetLock />
                    </span>
                    {t('projectObjectives')}
                  </div>
                }
                value={currentProject.objectives}
                onChange={(e) => handleProjectInputChange('objectives', e.target.value)}
              />
            </div>
          </div>
          <div className="col-lg-7">
            <div className="project-edition-modal-objectives-md">
              <label htmlFor="debouncedObjectives" className="text-center w-100">
                {t('projectObjectivesMarkdown')}
              </label>
              <div className="project-edition-modal-objectives-md-render">
                <div id="debouncedObjectives">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {debouncedObjectives || ''}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="row mb-3">
          <div className="col-lg-8">
            <InputSNCF
              noMargin
              id="projectInputFunders"
              type="text"
              name="projectInputFunders"
              label={
                <div className="d-flex align-items-center">
                  <span className="mr-2">
                    <MdBusinessCenter />
                  </span>
                  {t('projectFunders')}
                </div>
              }
              value={currentProject.funders}
              onChange={(e) => handleProjectInputChange('funders', e.target.value)}
            />
          </div>
          <div className="col-lg-4">
            <InputSNCF
              noMargin
              id="projectInputBudget"
              type="number"
              name="projectInputBudget"
              unit="€"
              label={
                <div className="d-flex align-items-center">
                  <span className="mr-2">
                    <RiMoneyEuroCircleLine />
                  </span>
                  {t('projectBudget')}
                </div>
              }
              value={currentProject.budget !== undefined ? currentProject.budget : ''}
              onChange={(e) =>
                handleProjectInputChange(
                  'budget',
                  e.target.value !== '' ? +e.target.value : undefined
                )
              }
              textRight
            />
          </div>
        </div>
        <ChipsSNCF
          addTag={addTag}
          tags={currentProject.tags}
          removeTag={removeTag}
          title={t('projectTags')}
          color="purple"
        />
      </ModalBodySNCF>
      <ModalFooterSNCF>
        <div className="d-flex justify-content-end w-100">
          {editionMode && (
            <button
              className="btn btn-outline-danger mr-auto"
              type="button"
              onClick={removeProject}
            >
              <span className="mr-2">
                <Trash />
              </span>
              {t('projectDeleteButton')}
            </button>
          )}
          <button className="btn btn-secondary mr-2" type="button" onClick={closeModal}>
            {t('projectCancel')}
          </button>
          {editionMode ? (
            <button
              data-testid="updateProject"
              className="btn btn-warning"
              type="button"
              onClick={updateProject}
            >
              <span className="mr-2">
                <Pencil />
              </span>
              {t('projectModifyButton')}
            </button>
          ) : (
            <button
              data-testid="createProject"
              className="btn btn-primary"
              type="button"
              onClick={createProject}
            >
              <span className="mr-2">
                <FaPlus />
              </span>
              {t('projectCreateButton')}
            </button>
          )}
        </div>
      </ModalFooterSNCF>
    </div>
  );
}
