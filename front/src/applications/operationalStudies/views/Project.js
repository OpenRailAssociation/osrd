import React, { useContext, useEffect, useMemo, useState } from 'react';
import NavBarSNCF from 'common/BootstrapSNCF/NavBarSNCF';
import logo from 'assets/pictures/views/studies.svg';
import { useTranslation } from 'react-i18next';
import nextId from 'react-id-generator';
import { getRandomImage } from 'applications/operationalStudies/components/Helpers/genFakeDataForProjects';
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
import AddAndEditStudyModal from '../components/Study/AddAndEditStudyModal';
import { PROJECTS_URI, STUDIES_URI } from '../components/operationalStudiesConsts';
import AddAndEditProjectModal from '../components/Project/AddAndEditProjectModal';
import BreadCrumbs from '../components/BreadCrumbs';

function displayStudiesList(studiesList, setFilterChips) {
  return studiesList ? (
    <div className="row no-gutters">
      {studiesList.map((details) => (
        <div className="col-xl-6" key={nextId()}>
          <StudyCard details={details} setFilterChips={setFilterChips} />
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
  const [projectDetails, setProjectDetails] = useState();
  const [studiesList, setStudiesList] = useState();
  const [filter, setFilter] = useState('');
  const [filterChips, setFilterChips] = useState('');
  const [sortOption, setSortOption] = useState('-last_modification');
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

  const getProjectDetail = async (withNotification = false) => {
    try {
      const result = await get(`${PROJECTS_URI}${projectID}/`);
      setProjectDetails(result);
      if (withNotification) {
        dispatch(
          setSuccess({
            title: t('projectUpdated'),
            text: t('projectUpdatedDetails', { name: projectDetails.name }),
          })
        );
      }
    } catch (error) {
      console.error(error);
    }
  };

  const getStudyList = async () => {
    try {
      const params = {
        ordering: sortOption,
        name: filter,
        description: filter,
        tags: filter,
      };
      const data = await get(`${PROJECTS_URI}${projectID}${STUDIES_URI}`, params);
      setStudiesList(data.results);
    } catch (error) {
      console.error(error);
    }
  };

  const handleSortOptions = (e) => {
    setSortOption(e.target.value);
  };

  useEffect(() => {
    getProjectDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    getStudyList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortOption, filter]);

  return (
    <>
      <NavBarSNCF
        appName={<BreadCrumbs projectName={projectDetails ? projectDetails.name : null} />}
        logo={logo}
      />
      <main className="mastcontainer mastcontainer-no-mastnav">
        <div className="p-3">
          {projectDetails ? (
            <div className="project-details">
              <div className="project-details-title">
                <div className="row w-100">
                  <div className={projectDetails.image_url ? 'col-lg-4 col-md-4' : 'd-none'}>
                    <div className="project-details-title-img">
                      <img src={projectDetails.image_url} alt="project logo" />
                    </div>
                  </div>
                  <div className={projectDetails.image_url ? 'col-lg-8 col-md-8' : 'col-12'}>
                    <div className="project-details-title-content">
                      <div className="project-details-title-name">
                        {projectDetails.name}
                        <button
                          className="project-details-title-modify-button"
                          type="button"
                          onClick={() =>
                            openModal(
                              <AddAndEditProjectModal
                                editionMode
                                details={projectDetails}
                                getProjectDetail={getProjectDetail}
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
                            {projectDetails.description}
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
                              {projectDetails.objectives}
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
                  <div>{projectDetails.funders}</div>
                </div>
                <div className="project-details-financials-amount">
                  <span className="project-details-financials-amount-text">{t('totalBudget')}</span>
                  {budgetFormat(projectDetails.budget)}
                </div>
              </div>
              <div className="project-details-tags">
                {projectDetails.tags?.map((tag) => (
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
              onClick={() => openModal(<AddAndEditStudyModal />, 'xl')}
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
