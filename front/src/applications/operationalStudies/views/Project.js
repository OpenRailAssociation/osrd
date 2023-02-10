import React, { useContext, useEffect, useMemo, useState } from 'react';
import NavBarSNCF from 'common/BootstrapSNCF/NavBarSNCF';
import logo from 'assets/pictures/views/studies.svg';
import { useTranslation } from 'react-i18next';
import nextId from 'react-id-generator';
import StudyCard from 'applications/operationalStudies/components/Project/StudyCard';
import Loader from 'common/Loader';
import OptionsSNCF from 'common/BootstrapSNCF/OptionsSNCF';
import { BiTargetLock } from 'react-icons/bi';
import { FaPencilAlt, FaPlus } from 'react-icons/fa';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { budgetFormat } from 'utils/numbers';
import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import { getProjectID } from 'reducers/osrdconf/selectors';
import { useSelector, useDispatch } from 'react-redux';
import { get } from 'common/requests';
import { setSuccess } from 'reducers/main';
import FilterTextField from 'applications/operationalStudies/components/FilterTextField';
import AddOrEditStudyModal from '../components/Study/AddOrEditStudyModal';
import { PROJECTS_URI, STUDIES_URI } from '../components/operationalStudiesConsts';
import AddOrEditProjectModal from '../components/Project/AddOrEditProjectModal';
import BreadCrumbs from '../components/BreadCrumbs';

function displayStudiesList(studiesList, setFilterChips) {
  return studiesList ? (
    <div className="row no-gutters">
      {studiesList.map((study) => (
        <div className="col-xl-6" key={nextId()}>
          <StudyCard study={study} setFilterChips={setFilterChips} />
        </div>
      ))}
    </div>
  ) : (
    <span className="mt-5">
      <Loader position="center" />
    </span>
  );
}

export default function Project() {
  const { t } = useTranslation('operationalStudies/project');
  const { openModal } = useContext(ModalContext);
  const [project, setProject] = useState();
  const [studiesList, setStudiesList] = useState();
  const [filter, setFilter] = useState('');
  const [filterChips, setFilterChips] = useState('');
  const [sortOption, setSortOption] = useState('-last_modification');
  const [imageUrl, setImageUrl] = useState();
  const dispatch = useDispatch();
  const projectID = useSelector(getProjectID);

  const sortOptions = [
    {
      label: t('sortOptions.byName'),
      value: 'name',
    },
    {
      label: t('sortOptions.byRecentDate'),
      value: '-last_modification',
    },
  ];

  const getProjectImage = async (url) => {
    try {
      const image = await get(url, { responseType: 'blob' });
      setImageUrl(URL.createObjectURL(image));
    } catch (error) {
      console.error(error);
    }
  };

  const getProject = async (withNotification = false) => {
    try {
      const result = await get(`${PROJECTS_URI}${projectID}/`);
      setProject(result);
      if (result.image_url) {
        getProjectImage(`${PROJECTS_URI}${projectID}/image/`);
      }
      if (withNotification) {
        dispatch(
          setSuccess({
            title: t('projectUpdated'),
            text: t('projectUpdatedDetails', { name: project.name }),
          })
        );
      }
    } catch (error) {
      console.error(error);
    }
  };

  const getStudiesList = async () => {
    try {
      const params = {
        ordering: sortOption,
        name: filter,
        description: filter,
        tags: filter,
      };
      const data = await get(`${PROJECTS_URI}${projectID}${STUDIES_URI}`, { params });
      setStudiesList(data.results);
    } catch (error) {
      console.error(error);
    }
  };

  const handleSortOptions = (e) => {
    setSortOption(e.target.value);
  };

  useEffect(() => {
    getProject();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    getStudiesList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortOption, filter]);

  return (
    <>
      <NavBarSNCF
        appName={<BreadCrumbs projectName={project ? project.name : null} />}
        logo={logo}
      />
      <main className="mastcontainer mastcontainer-no-mastnav">
        <div className="p-3">
          {project ? (
            <div className="project-details">
              <div className="project-details-title">
                <div className="row w-100">
                  <div className={project.image_url ? 'col-lg-4 col-md-4' : 'd-none'}>
                    <div className="project-details-title-img">
                      <img src={imageUrl} alt="project logo" />
                    </div>
                  </div>
                  <div className={project.image_url ? 'col-lg-8 col-md-8' : 'col-12'}>
                    <div className="project-details-title-content">
                      <div className="project-details-title-name">
                        {project.name}
                        <button
                          className="project-details-title-modify-button"
                          type="button"
                          onClick={() =>
                            openModal(
                              <AddOrEditProjectModal
                                editionMode
                                project={project}
                                getProject={getProject}
                              />,
                              'xl'
                            )
                          }
                        >
                          <span className="project-details-title-modify-button-text">
                            {t('modifyProject')}
                          </span>
                          <FaPencilAlt />
                        </button>
                      </div>
                      <div className="row">
                        <div className="col-xl-6">
                          <div className="project-details-title-description">
                            {project.description}
                          </div>
                        </div>
                        <div className="col-xl-6">
                          <h3>
                            <span className="mr-2">
                              <BiTargetLock />
                            </span>
                            {t('objectives')}
                          </h3>
                          <div className="project-details-title-objectives">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {project.objectives}
                            </ReactMarkdown>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="project-details-financials">
                <div className="project-details-financials-infos">
                  <h3>{t('fundedBy')}</h3>
                  <div>{project.funders}</div>
                </div>
                <div className="project-details-financials-amount">
                  <span className="project-details-financials-amount-text">{t('totalBudget')}</span>
                  {budgetFormat(project.budget)}
                </div>
              </div>
              <div className="project-details-tags">
                {project.tags?.map((tag) => (
                  <div className="project-details-tags-tag" key={nextId()}>
                    {tag}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <span className="mt-5">
              <Loader position="center" />
            </span>
          )}

          <div className="studies-toolbar">
            <div className="h1 mb-0">
              {t('studiesCount', { count: studiesList ? studiesList.length : 0 })}
            </div>
            <div className="flex-grow-1">
              <FilterTextField
                setFilter={setFilter}
                filterChips={filterChips}
                id="studies-filter"
              />
            </div>
            <OptionsSNCF
              name="projects-sort-filter"
              onChange={handleSortOptions}
              selectedValue={sortOption}
              options={sortOptions}
            />
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => openModal(<AddOrEditStudyModal />, 'xl')}
            >
              <FaPlus />
              <span className="ml-2">{t('createStudy')}</span>
            </button>
          </div>

          <div className="studies-list">
            {useMemo(() => displayStudiesList(studiesList, setFilterChips), [studiesList])}
          </div>
        </div>
      </main>
    </>
  );
}
