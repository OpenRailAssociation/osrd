import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import NavBarSNCF from 'common/BootstrapSNCF/NavBarSNCF';
import logo from 'assets/pictures/views/studies.svg';
import { useTranslation } from 'react-i18next';
import nextId from 'react-id-generator';
import StudyCard from 'modules/study/components/StudyCard';
import StudyCardEmpty from 'modules/study/components/StudyCardEmpty';
import Loader from 'common/Loader';
import OptionsSNCF from 'common/BootstrapSNCF/OptionsSNCF';
import { BiTargetLock } from 'react-icons/bi';
import { FaPencilAlt } from 'react-icons/fa';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { budgetFormat } from 'utils/numbers';
import { useModal } from 'common/BootstrapSNCF/ModalSNCF';
import { getProjectID } from 'reducers/osrdconf/selectors';
import { useDispatch, useSelector } from 'react-redux';
import FilterTextField from 'applications/operationalStudies/components/FilterTextField';
import {
  PostSearchApiArg,
  SearchResultItemStudy,
  StudyResult,
  osrdEditoastApi,
} from 'common/api/osrdEditoastApi';
import { setFailure } from 'reducers/main';
import { getDocument } from 'common/api/documentApi';
import AddOrEditProjectModal from '../../../modules/project/components/AddOrEditProjectModal';
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
      <div className="col-hdp-3 col-hd-4 col-lg-6">
        <StudyCardEmpty />
      </div>
      {studiesList.map((study) => (
        <div className="col-hdp-3 col-hd-4 col-lg-6" key={`project-displayStudiesList-${study.id}`}>
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
  const [studiesList, setStudiesList] = useState<StudyResult[]>([]);
  const [filter, setFilter] = useState('');
  const [filterChips, setFilterChips] = useState('');
  const [sortOption, setSortOption] = useState<SortOptions>('LastModifiedDesc');
  const [imageUrl, setImageUrl] = useState('');
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const projectId = useSelector(getProjectID);
  const [postSearch] = osrdEditoastApi.usePostSearchMutation();
  const [getStudies] = osrdEditoastApi.useLazyGetProjectsByProjectIdStudiesQuery();

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

  const { data: project, isError: isProjectError } = osrdEditoastApi.useGetProjectsByProjectIdQuery(
    { projectId: projectId as number },
    {
      skip: !projectId,
    }
  );

  const updateImage = async () => {
    if (project?.image) {
      const image = await getDocument(project.image);
      setImageUrl(URL.createObjectURL(image));
    }
  };

  const getStudiesList = async () => {
    if (projectId) {
      if (filter) {
        const payload: PostSearchApiArg = {
          pageSize: 1000,
          searchPayload: {
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
          let filteredStudies = (await postSearch(payload).unwrap()) as SearchResultItemStudy[];
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
          setStudiesList(filteredStudies as StudyResult[]);
        } catch (error) {
          console.error(error);
        }
      } else {
        try {
          const { data } = await getStudies({ projectId, ordering: sortOption, pageSize: 1000 });
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
    }
  }, []);

  useEffect(() => {
    updateImage();
  }, [project?.image]);

  useEffect(() => {
    if (isProjectError) {
      dispatch(
        setFailure({
          name: t('errorHappened'),
          message: t('errorHappened'),
        })
      );
    }
  }, [isProjectError]);

  useEffect(() => {
    if (projectId) getStudiesList();
  }, [sortOption, filter]);

  return (
    <>
      <NavBarSNCF appName={<BreadCrumbs projectName={project && project.name} />} logo={logo} />
      <main className="mastcontainer mastcontainer-no-mastnav">
        <div className="p-3 project-view">
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
                            openModal(<AddOrEditProjectModal editionMode project={project} />, 'xl')
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
              {project.funders || project.budget ? (
                <div className="project-details-financials">
                  <div className="project-details-financials-infos">
                    <h3>{t('fundedBy')}</h3>
                    <div>{project.funders}</div>
                  </div>
                  <div className="project-details-financials-amount">
                    <span className="project-details-financials-amount-text">
                      {t('totalBudget')}
                    </span>
                    {project.budget !== undefined && project.budget !== 0
                      ? budgetFormat(project.budget)
                      : ''}
                  </div>
                </div>
              ) : null}
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
