import React, { useContext, useEffect, useState } from 'react';
import NavBarSNCF from 'common/BootstrapSNCF/NavBarSNCF';
import logo from 'assets/pictures/views/studies.svg';
import { useTranslation } from 'react-i18next';
import nextId from 'react-id-generator';
import { getRandomImage } from 'applications/operationalStudies/components/Helpers/genFakeDataForProjects';
import StudyCard from 'applications/operationalStudies/components/Project/StudyCard';
import Loader from 'common/Loader';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
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
import AddAndEditStudyModal from '../components/Study/AddAndEditStudyModal';
import { PROJECTS_URI, STUDIES_URI } from '../components/operationalStudiesConsts';
import AddAndEditProjectModal from '../components/Project/AddAndEditProjectModal';
import BreadCrumbs from '../components/HomeContent/BreadCrumbs';

export default function Project() {
  const { t } = useTranslation('operationalStudies/project');
  const { openModal } = useContext(ModalContext);
  const [projectDetails, setProjectDetails] = useState();
  const [studiesList, setStudiesList] = useState();
  const [filter, setFilter] = useState('');
  const [sortOption, setSortOption] = useState('byName');
  const dispatch = useDispatch();
  const projectID = useSelector(getProjectID);

  const sortOptions = [
    {
      label: t('sortOptions.byName'),
      value: 'byName',
    },
    {
      label: t('sortOptions.byRecentDate'),
      value: 'byRecentDate',
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
      const data = await get(`${PROJECTS_URI}${projectID}${STUDIES_URI}`);
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
    getStudyList();
  }, []);

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
                  <div className="col-lg-4 col-md-4">
                    <div className="project-details-title-img">
                      <img src={getRandomImage(projectDetails.id)} alt="project logo" />
                    </div>
                  </div>
                  <div className="col-lg-8 col-md-8">
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
                {projectDetails.tags.map((tag) => (
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
              <InputSNCF
                type="text"
                id="studies-filter"
                name="studies-filter"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder={t('filterPlaceholder')}
                whiteBG
                noMargin
                unit={<i className="icons-search" />}
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
            {studiesList ? (
              <div className="row no-gutters">
                {studiesList.map((details) => (
                  <div className="col-xl-6" key={nextId()}>
                    <StudyCard details={details} />
                  </div>
                ))}
              </div>
            ) : (
              <span className="mt-5">
                <Loader position="center" />
              </span>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
