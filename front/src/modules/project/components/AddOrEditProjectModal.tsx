import React, { useContext, useEffect, useState } from 'react';
import projectLogo from 'assets/pictures/views/projects.svg';
import ChipsSNCF from 'common/BootstrapSNCF/ChipsSNCF';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import ModalBodySNCF from 'common/BootstrapSNCF/ModalSNCF/ModalBodySNCF';
import ModalFooterSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalFooterSNCF';
import ModalHeaderSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalHeaderSNCF';
import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import TextareaSNCF from 'common/BootstrapSNCF/TextareaSNCF';
import { deleteRequest } from 'common/requests';
import { useTranslation } from 'react-i18next';
import { BiTargetLock } from 'react-icons/bi';
import { FaPencilAlt, FaPlus, FaTrash } from 'react-icons/fa';
import { MdBusinessCenter, MdDescription, MdTitle } from 'react-icons/md';
import { RiMoneyEuroCircleLine } from 'react-icons/ri';
import { ReactMarkdown } from 'react-markdown/lib/react-markdown';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { setFailure, setSuccess } from 'reducers/main';
import { updateProjectID } from 'reducers/osrdconf';
import remarkGfm from 'remark-gfm';
import { useDebounce } from 'utils/helpers';
import { ProjectCreateRequest, ProjectResult, osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { postDocument } from 'common/api/documentApi';
import { RootState } from 'reducers';
import { PROJECTS_URI } from 'applications/operationalStudies/components/operationalStudiesConsts';
import PictureUploader from 'applications/operationalStudies/components/Project/PictureUploader';

const emptyProject: ProjectCreateRequest = {
  budget: 0,
  description: '',
  funders: '',
  image: null,
  name: '',
  objectives: '',
  tags: [],
};

interface ProjectForm extends ProjectCreateRequest {
  id?: number;
}

type AddOrEditProjectModalProps = {
  editionMode?: boolean;
  project?: ProjectResult;
  getProject?: (v: boolean) => void;
};

export default function AddOrEditProjectModal({
  editionMode,
  project,
  getProject,
}: AddOrEditProjectModalProps) {
  const { t } = useTranslation('operationalStudies/project');
  const { closeModal } = useContext(ModalContext);
  const [currentProject, setCurrentProject] = useState<ProjectForm>(project || emptyProject);
  const [tempProjectImage, setTempProjectImage] = useState<Blob | null | undefined>();

  const [displayErrors, setDisplayErrors] = useState(false);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const safeWord = useSelector((state: RootState) => state.main.safeWord);

  const [postProject] = osrdEditoastApi.endpoints.postProjects.useMutation();
  const [patchProject] = osrdEditoastApi.endpoints.patchProjectsByProjectId.useMutation();

  const removeTag = (idx: number) => {
    const newTags = Array.from(currentProject.tags);
    newTags.splice(idx, 1);
    setCurrentProject({ ...currentProject, tags: newTags });
  };

  const addTag = (tag: string) => {
    const newTags = Array.from(currentProject.tags);
    newTags.push(tag);
    if (currentProject) setCurrentProject({ ...currentProject, tags: newTags });
  };

  const uploadImage = async (image: Blob): Promise<number | null> => {
    try {
      const imageId = await postDocument(image as Blob);
      return imageId;
    } catch (error: unknown) {
      if (error instanceof Error) {
        dispatch(
          setFailure({
            name: t('error.unableToPostDocumentTitle'),
            message: t('error.unableToPostDocument'),
          })
        );
      }
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
          projectCreateRequest: currentProject,
        });
        request
          .unwrap()
          .then((projectCreated) => {
            dispatch(updateProjectID(projectCreated.id));
            navigate('/operational-studies/project');
            closeModal();
          })
          .catch((error) => console.error(error));
      } catch (error) {
        console.error(error);
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
          projectPatchRequest: editedProject,
        });
        request
          .unwrap()
          .then(() => {
            if (getProject) getProject(true);
            closeModal();
          })
          .catch((error) => console.error(error));
      } catch (error) {
        console.error(error);
      }
    }
  };

  const deleteProject = async () => {
    if (project) {
      try {
        await deleteRequest(`${PROJECTS_URI}${project.id}/`);
        dispatch(updateProjectID(undefined));
        navigate('/operational-studies');
        closeModal();
        dispatch(
          setSuccess({
            title: t('projectDeleted'),
            text: t('projectDeletedDetails', { name: project.name }),
          })
        );
      } catch (error) {
        console.error(error);
      }
    }
  };

  const debouncedObjectives = useDebounce(currentProject.objectives, 500);

  useEffect(() => {
    if (safeWord !== '') {
      addTag(safeWord);
    }
  }, [safeWord]);

  return (
    <div className="project-edition-modal">
      <ModalHeaderSNCF withCloseButton withBorderBottom>
        <h1 className="project-edition-modal-title">
          <img src={projectLogo} alt="Project Logo" />
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
                label={
                  <div className="d-flex align-items-center">
                    <span className="mr-2">
                      <MdTitle />
                    </span>
                    <span className="font-weight-bold">{t('projectName')}</span>
                  </div>
                }
                value={currentProject.name}
                onChange={(e) => setCurrentProject({ ...currentProject, name: e.target.value })}
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
                onChange={(e) =>
                  setCurrentProject({ ...currentProject, description: e.target.value })
                }
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
                onChange={(e) =>
                  setCurrentProject({ ...currentProject, objectives: e.target.value })
                }
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
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{debouncedObjectives}</ReactMarkdown>
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
              onChange={(e) =>
                setCurrentProject({
                  ...currentProject,
                  funders: e.target.value,
                })
              }
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
              value={currentProject.budget}
              onChange={(e) => setCurrentProject({ ...currentProject, budget: +e.target.value })}
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
              onClick={deleteProject}
            >
              <span className="mr-2">
                <FaTrash />
              </span>
              {t('projectDeleteButton')}
            </button>
          )}
          <button className="btn btn-secondary mr-2" type="button" onClick={closeModal}>
            {t('projectCancel')}
          </button>
          {editionMode ? (
            <button className="btn btn-warning" type="button" onClick={updateProject}>
              <span className="mr-2">
                <FaPencilAlt />
              </span>
              {t('projectModifyButton')}
            </button>
          ) : (
            <button className="btn btn-primary" type="button" onClick={createProject}>
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
