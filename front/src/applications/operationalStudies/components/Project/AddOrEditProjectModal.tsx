import React, { useContext, useState } from 'react';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { projectTypes } from 'applications/operationalStudies/components/operationalStudiesTypes';
import projectLogo from 'assets/pictures/views/projects.svg';
import ChipsSNCF from 'common/BootstrapSNCF/ChipsSNCF';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import ModalBodySNCF from 'common/BootstrapSNCF/ModalSNCF/ModalBodySNCF';
import ModalFooterSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalFooterSNCF';
import ModalHeaderSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalHeaderSNCF';
import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import TextareaSNCF from 'common/BootstrapSNCF/TextareaSNCF';
import DOCUMENT_URI from 'common/consts';
import { deleteRequest, patch, patchMultipart, post } from 'common/requests';
import { useTranslation } from 'react-i18next';
import { BiTargetLock } from 'react-icons/bi';
import { FaPencilAlt, FaPlus, FaTrash } from 'react-icons/fa';
import { MdBusinessCenter, MdDescription, MdTitle } from 'react-icons/md';
import { RiMoneyEuroCircleLine } from 'react-icons/ri';
import { ReactMarkdown } from 'react-markdown/lib/react-markdown';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { setSuccess } from 'reducers/main';
import { updateProjectID } from 'reducers/osrdconf';
import remarkGfm from 'remark-gfm';
import { useDebounce } from 'utils/helpers';
import { PROJECTS_URI } from '../operationalStudiesConsts';
import PictureUploader from './PictureUploader';

export type Props = {
  editionMode?: false;
  project?: projectTypes;
  getProject?: any;
};

const currentProjectDefaults = {
  name: '',
  description: '',
  objectives: '',
  funders: '',
  tags: [],
  budget: 0,
};

export default function AddOrEditProjectModal({ editionMode, project, getProject }: Props) {
  const { t } = useTranslation('operationalStudies/project');
  const { closeModal } = useContext(ModalContext);
  const [currentProject, setCurrentProject] = useState<projectTypes>(
    project || currentProjectDefaults
  );

  const [displayErrors, setDisplayErrors] = useState(false);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const removeTag = (idx: number) => {
    const newTags: string[] = Array.from(currentProject.tags);
    newTags.splice(idx, 1);
    setCurrentProject({ ...currentProject, tags: newTags });
  };

  const addTag = (tag: string) => {
    const newTags: string[] = currentProject.tags ? Array.from(currentProject.tags) : [];
    newTags.push(tag);
    setCurrentProject({ ...currentProject, tags: newTags });
  };

  const getDocKey = async (image: Blob) => {
    const { document_key: docKey } = await post(`${DOCUMENT_URI}`, image, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return docKey;
  };

  const createProject = async () => {
    if (!currentProject.name) {
      setDisplayErrors(true);
    } else {
      try {
        if (currentProject.image) {
          currentProject.image = await getDocKey(currentProject.image as Blob);
        }
        const result = await post(PROJECTS_URI, currentProject);
        dispatch(updateProjectID(result.id));
        navigate('/operational-studies/project');
        closeModal();
      } catch (error) {
        console.error(error);
      }
    }
  };

  const updateProject = async () => {
    if (!currentProject.name) {
      setDisplayErrors(true);
    } else if (project) {
      try {
        let imageId = currentProject.image_id;
        if (currentProject.image) {
          imageId = await getDocKey(currentProject.image as Blob);
        }

        currentProject.image = imageId;
        await patch(`${PROJECTS_URI}${project.id}/`, currentProject);
        getProject(true);
        closeModal();
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
          <div className="col-xl-4 col-lg-5 col-md-6">
            <div className="project-edition-modal-picture">
              <PictureUploader
                currentProject={currentProject}
                setCurrentProject={setCurrentProject}
              />
            </div>
          </div>
          <div className="col-xl-8 col-lg-7 col-md-6">
            <div className="project-edition-modal-name">
              <InputSNCF
                id="projectInputName"
                type="text"
                name="projectInputName"
                label={
                  <div className="d-flex align-items-center">
                    <span className="mr-2">
                      <MdTitle />
                    </span>
                    <span className="font-weight-bold">{t('projectName')}</span>
                  </div>
                }
                value={currentProject.name}
                onChange={(e: any) =>
                  setCurrentProject({ ...currentProject, name: e.target.value })
                }
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
                onChange={(e: any) =>
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
                onChange={(e: any) =>
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
              onChange={(e: any) =>
                setCurrentProject({
                  ...currentProject,
                  funders: e.target.value ? e.target.value : '',
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
              onChange={(e: any) =>
                setCurrentProject({ ...currentProject, budget: e.target.value })
              }
            />
          </div>
        </div>
        <ChipsSNCF
          addTag={addTag}
          tags={currentProject.tags || []}
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
