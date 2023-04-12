import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import NavBarSNCF from 'common/BootstrapSNCF/NavBarSNCF';
import logo from 'assets/pictures/views/studies.svg';
import { useTranslation } from 'react-i18next';
import nextId from 'react-id-generator';
import StudyCard from 'applications/operationalStudies/components/Project/StudyCard';
import StudyCardEmpty from 'applications/operationalStudies/components/Project/StudyCardEmpty';
import Loader from 'common/Loader';
import OptionsSNCF from 'common/BootstrapSNCF/OptionsSNCF';
import { BiTargetLock } from 'react-icons/bi';
import { FaPencilAlt } from 'react-icons/fa';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { budgetFormat } from 'utils/numbers';
import { useModal } from 'common/BootstrapSNCF/ModalSNCF';
import { getProjectID } from 'reducers/osrdconf/selectors';
import { useSelector, useDispatch } from 'react-redux';
import { get } from 'common/requests';
import { setSuccess } from 'reducers/main';
import FilterTextField from 'applications/operationalStudies/components/FilterTextField';
import DOCUMENT_URI from 'common/consts';
import {
  PostSearchApiArg,
  ProjectResult,
  SearchStudyResult,
  StudyResult,
  osrdEditoastApi,
} from 'common/api/osrdEditoastApi';
import AddOrEditProjectModal from '../components/Project/AddOrEditProjectModal';
import BreadCrumbs from '../components/BreadCrumbs';

type SortOptions =
  | 'NameAsc'
  | 'NameDesc'
  | 'CreationDateAsc'
  | 'CreationDateDesc'
  | 'LastModifiedAsc'
  | 'LastModifiedDesc';

function displayStudiesList(
  studiesList: StudyResult[],
  setFilterChips: (filterchips: string) => void
) {
  return studiesList ? (
    <div className="row no-gutters">
      <div className="col-xl-4 col-lg-6">
        <StudyCardEmpty />
      </div>
      {studiesList.map((study) => (
        <div className="col-xl-4 col-lg-6" key={`project-displayStudiesList-${study.id}`}>
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
  const { openModal } = useModal();
  const [project, setProject] = useState<ProjectResult>();
  const [studiesList, setStudiesList] = useState<StudyResult[]>([]);
  const [filter, setFilter] = useState('');
  const [filterChips, setFilterChips] = useState('');
  const [sortOption, setSortOption] = useState<SortOptions>('LastModifiedDesc');
  const [imageUrl, setImageUrl] = useState('');
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const projectId = useSelector(getProjectID);
  // const {
  //   data: currentProject,
  //   isLoading,
  //   isError,
  //   error: projectError,
  // } = osrdEditoastApi.useGetProjectsByProjectIdQuery({ projectId: projectId as number });
  const [getCurrentProject] = osrdEditoastApi.useLazyGetProjectsByProjectIdQuery();
  const [postSearch] = osrdEditoastApi.usePostSearchMutation();
  const [getStudies] = osrdEditoastApi.useLazyGetProjectsByProjectIdStudiesQuery();

  // if (isError) {
  //   console.error('getProject Error : ', projectError);
  //   return <span className="mt-5">An error occured</span>;
  // }

  const sortOptions = [
    {
      label: t('sortOptions.byName'),
      value: 'NameAsc',
    },
    {
      label: t('sortOptions.byRecentDate'),
      value: 'LastModifiedDesc',
    },
  ];

  const getProjectImage = async (url: string) => {
    try {
      const image: Blob = await get(url, { responseType: 'blob' });
      setImageUrl(URL.createObjectURL(image));
    } catch (error) {
      console.error(error);
    }
  };

  const getProject = async (withNotification = false) => {
    try {
      const { data } = await getCurrentProject({ projectId: projectId as number });
      setProject(data);
      if (data?.image) {
        await getProjectImage(`${DOCUMENT_URI}${data.image}`);
      }
      if (withNotification) {
        dispatch(
          setSuccess({
            title: t('projectUpdated'),
            text: t('projectUpdatedDetails', { name: project?.name }),
          })
        );
      }
    } catch (error) {
      console.error(error);
    }
  };

  const getStudiesList = async () => {
    if (projectId) {
      if (filter) {
        const payload: PostSearchApiArg = {
          body: {
            object: 'study',
            query: [
              'and',
              [
                'or',
                ['search', ['name'], filter],
                ['search', ['description'], filter],
                ['search', ['tags'], filter],
              ],
              ['=', ['project_id'], projectId],
            ],
          },
        };
        try {
          const filteredData = await postSearch(payload).unwrap();
          let filteredStudies = [...filteredData] as SearchStudyResult[];
          if (sortOption === 'LastModifiedDesc') {
            filteredStudies = filteredStudies.sort((a, b) => {
              if (a.last_modification && b.last_modification) {
                return b.last_modification.localeCompare(a.last_modification);
              }
              return 0;
            });
          } else if (sortOption === 'NameAsc') {
            filteredStudies = filteredStudies.sort((a, b) => {
              if (a.name && b.name) {
                return a.name.localeCompare(b.name);
              }
              return 0;
            });
          }
          setStudiesList(filteredStudies);
        } catch (error) {
          console.error(error);
        }
      } else {
        try {
          const { data } = await getStudies({ projectId, ordering: sortOption });
          if (data?.results) setStudiesList(data.results);
        } catch (error) {
          console.error(error);
        }
      }
    }
  };

  const handleSortOptions = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSortOption(e.target.value as SortOptions);
  };

  useEffect(() => {
    if (!projectId) {
      navigate('/operational-studies');
    } else {
      getProject();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (projectId) getStudiesList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortOption, filter]);

  return (
    <>
      <NavBarSNCF appName={<BreadCrumbs projectName={project && project.name} />} logo={logo} />
      <main className="mastcontainer mastcontainer-no-mastnav">
        <div className="p-3">
          {project ? (
            <div className="project-details">
              <div className="project-details-title">
                <div className="row w-100 no-gutters">
                  <div className={project.image ? 'col-lg-4 col-md-4' : 'd-none'}>
                    <div className="project-details-title-img">
                      <img src={imageUrl} alt="project logo" />
                    </div>
                  </div>
                  <div className={project.image ? 'pl-md-2 col-lg-8 col-md-8' : 'col-12'}>
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
                            {project.objectives && (
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {project.objectives}
                              </ReactMarkdown>
                            )}
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
                  {project.budget && budgetFormat(project.budget)}
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
          </div>

          <div className="studies-list">
            {useMemo(() => displayStudiesList(studiesList, setFilterChips), [studiesList])}
          </div>
        </div>
      </main>
    </>
  );
}
