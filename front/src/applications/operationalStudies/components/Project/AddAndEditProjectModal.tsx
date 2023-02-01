/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useContext, useState } from 'react';
import ModalHeaderSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalHeaderSNCF';
import ModalBodySNCF from 'common/BootstrapSNCF/ModalSNCF/ModalBodySNCF';
import projectLogo from 'assets/pictures/views/projects.svg';
import { useTranslation } from 'react-i18next';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import TextareaSNCF from 'common/BootstrapSNCF/TextareaSNCF';
import { useDebounce } from 'utils/helpers';
import { ReactMarkdown } from 'react-markdown/lib/react-markdown';
import { BiTargetLock } from 'react-icons/bi';
import remarkGfm from 'remark-gfm';
import { MdBusinessCenter, MdDescription, MdTitle } from 'react-icons/md';
import { RiMoneyEuroCircleLine } from 'react-icons/ri';
import ModalFooterSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalFooterSNCF';
import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import ChipsSNCF from 'common/BootstrapSNCF/ChipsSNCF';
import { FaPencilAlt, FaPlus, FaTrash } from 'react-icons/fa';
import { deleteRequest, post, put } from 'common/requests';
import { updateProjectID } from 'reducers/osrdconf';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { setSuccess } from 'reducers/main';
import { PROJECTS_URI } from '../operationalStudiesConsts';
import PictureUploader from './PictureUploader';
import { configItemsTypes } from './types';

export type Props = {
  editionMode: false;
  details?: configItemsTypes;
  getProjectDetail?: any;
};

const configItemsDefaults = {
  name: '',
  description: '',
  objectives: '',
  funders: [],
  tags: [],
  budget: 0,
};

export default function AddAndEditProjectModal({ editionMode, details, getProjectDetail }: Props) {
  const { t } = useTranslation('operationalStudies/project');
  const { closeModal } = useContext(ModalContext);
  const [configItems, setConfigItems] = useState<configItemsTypes>(details || configItemsDefaults);
  const [displayErrors, setDisplayErrors] = useState(false);
  const dispatch = useDispatch();
  const navigate = useNavigate();

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

  const createProject = async () => {
    if (!configItems.name) {
      setDisplayErrors(true);
    } else {
      try {
        const result = await post(PROJECTS_URI, configItems);
        dispatch(updateProjectID(result.id));
        navigate('/operational-studies/project');
        closeModal();
      } catch (error) {
        console.error(error);
      }
    }
  };

  const modifyProject = async () => {
    if (!configItems.name) {
      setDisplayErrors(true);
    } else if (details) {
      try {
        await put(`${PROJECTS_URI}${details.id}/`, configItems);
        getProjectDetail(true);
        closeModal();
      } catch (error) {
        console.error(error);
      }
    }
  };

  const deleteProject = async () => {
    if (details) {
      try {
        await deleteRequest(`${PROJECTS_URI}${details.id}/`);
        dispatch(updateProjectID(undefined));
        navigate('/operational-studies');
        closeModal();
        dispatch(
          setSuccess({
            title: t('projectDeleted'),
            text: t('projectDeletedDetails', { name: details.name }),
          })
        );
      } catch (error) {
        console.error(error);
      }
    }
  };

  const debouncedObjectives = useDebounce(configItems.objectives, 500);

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
          <div className="col-lg-4">
            <div className="project-edition-modal-picture">
              <PictureUploader configItems={configItems} setConfigItems={setConfigItems} />
            </div>
          </div>
          <div className="col-lg-8">
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
                value={configItems.name}
                onChange={(e: any) => setConfigItems({ ...configItems, name: e.target.value })}
                isInvalid={displayErrors && !configItems.name}
                errorMsg={displayErrors && !configItems.name ? t('projectNameMissing') : undefined}
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
                value={configItems.description}
                onChange={(e: any) =>
                  setConfigItems({ ...configItems, description: e.target.value })
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
                value={configItems.objectives}
                onChange={(e: any) =>
                  setConfigItems({ ...configItems, objectives: e.target.value })
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
              value={configItems.funders.join()}
              onChange={(e: any) => setConfigItems({ ...configItems, funders: [e.target.value] })}
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
              value={configItems.budget}
              onChange={(e: any) => setConfigItems({ ...configItems, budget: e.target.value })}
            />
          </div>
        </div>
        <ChipsSNCF
          addTag={addTag}
          tags={configItems.tags}
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
            <button className="btn btn-warning" type="button" onClick={modifyProject}>
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
