import React, { useEffect, useMemo, useState } from 'react';

import { Pencil } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';
import { BiTargetLock } from 'react-icons/bi';
import nextId from 'react-id-generator';
import ReactMarkdown from 'react-markdown';
import { useParams } from 'react-router-dom';
import remarkGfm from 'remark-gfm';

import BreadCrumbs from 'applications/operationalStudies/components/BreadCrumbs';
import FilterTextField from 'applications/operationalStudies/components/FilterTextField';
import { getDocument } from 'common/api/documentApi';
import {
  type PostSearchApiArg,
  type StudyWithScenarios,
  osrdEditoastApi,
} from 'common/api/osrdEditoastApi';
import { useModal } from 'common/BootstrapSNCF/ModalSNCF';
import NavBarSNCF from 'common/BootstrapSNCF/NavBarSNCF';
import OptionsSNCF from 'common/BootstrapSNCF/OptionsSNCF';
import { Loader, Spinner } from 'common/Loaders';
import AddOrEditProjectModal from 'modules/project/components/AddOrEditProjectModal';
import StudyCard from 'modules/study/components/StudyCard';
import StudyCardEmpty from 'modules/study/components/StudyCardEmpty';
import { budgetFormat } from 'utils/numbers';

type SortOptions =
  | 'NameAsc'
  | 'NameDesc'
  | 'CreationDateAsc'
  | 'CreationDateDesc'
  | 'LastModifiedAsc'
  | 'LastModifiedDesc';

type ProjectParams = {
  projectId: string;
};
export default function Project() {
  const { t } = useTranslation('operationalStudies/project');
  const { openModal } = useModal();
  const [studiesList, setStudiesList] = useState<StudyWithScenarios[]>([]);
  const [filter, setFilter] = useState('');
  const [filterChips, setFilterChips] = useState('');
  const [sortOption, setSortOption] = useState<SortOptions>('LastModifiedDesc');
  const [imageUrl, setImageUrl] = useState('');
  const { projectId: urlProjectId } = useParams() as ProjectParams;
  const [postSearch] = osrdEditoastApi.endpoints.postSearch.useMutation();
  const [isLoading, setIsLoading] = useState(true);

  const { projectId } = useMemo(
    () => ({
      projectId: !Number.isNaN(+urlProjectId) ? +urlProjectId : undefined,
    }),
    [urlProjectId]
  );

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

  const {
    data: project,
    isError: isProjectError,
    error: projectError,
  } = osrdEditoastApi.endpoints.getProjectsByProjectId.useQuery(
    { projectId: +projectId! },
    {
      skip: !projectId,
    }
  );

  const { data: projectStudies } = osrdEditoastApi.endpoints.getProjectsByProjectIdStudies.useQuery(
    {
      projectId: Number(projectId),
      ordering: sortOption,
      pageSize: 1000,
    },
    { skip: !projectId }
  );

  const updateImage = async () => {
    if (project?.image) {
      const image = await getDocument(project.image);
      setImageUrl(URL.createObjectURL(image));
    }
  };

  const getStudiesList = async () => {
    setIsLoading(true);
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
          let filteredStudies = (await postSearch(payload).unwrap()) as StudyWithScenarios[];
          if (sortOption === 'LastModifiedDesc') {
            filteredStudies = [...filteredStudies].sort((a, b) =>
              b.last_modification.localeCompare(a.last_modification)
            );
          } else if (sortOption === 'NameAsc') {
            filteredStudies = [...filteredStudies].sort((a, b) => a.name.localeCompare(b.name));
          }
          setStudiesList(filteredStudies);
        } catch (error) {
          console.error(error);
        }
      } else {
        setStudiesList(projectStudies?.results || []);
      }
    }
    setIsLoading(false);
  };

  function displayStudiesList() {
    return !isLoading ? (
      <div className="row no-gutters">
        <div className="col-hdp-3 col-hd-4 col-lg-6">
          <StudyCardEmpty />
        </div>
        {studiesList.map((study) => (
          <div
            className="col-hdp-3 col-hd-4 col-lg-6"
            key={`project-displayStudiesList-${study.id}`}
          >
            <StudyCard study={study} setFilterChips={setFilterChips} />
          </div>
        ))}
      </div>
    ) : (
      <span className="mt-5 text-center">
        <Spinner displayDelay={500} />
      </span>
    );
  }

  const handleSortOptions = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSortOption(e.target.value as SortOptions);
  };

  useEffect(() => {
    if (!projectId) throw new Error('Project id is undefined');
  }, []);

  useEffect(() => {
    updateImage();
  }, [project?.image]);

  useEffect(() => {
    if (isProjectError && projectError) throw projectError;
  }, [isProjectError, projectError]);

  useEffect(() => {
    getStudiesList();
  }, [sortOption, filter, projectStudies]);

  return (
    <>
      <NavBarSNCF appName={<BreadCrumbs project={project} />} />
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
                            openModal(
                              <AddOrEditProjectModal editionMode project={project} />,
                              'xl',
                              'no-close-modal'
                            )
                          }
                        >
                          <span className="project-details-title-modify-button-text">
                            {t('modifyProject')}
                          </span>
                          <Pencil />
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
              {(project.funders || (project.budget !== 0 && project.budget !== null)) && (
                <div className="project-details-financials">
                  <div className="project-details-financials-infos">
                    <h3>{t('fundedBy')}</h3>
                    {project.funders && <div>{project.funders}</div>}
                  </div>
                  {project.budget ? (
                    <div className="project-details-financials-amount">
                      <span className="project-details-financials-amount-text">
                        {t('totalBudget')}
                      </span>
                      {budgetFormat(project.budget)}
                    </div>
                  ) : null}
                </div>
              )}
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

          <div className="studies-list">{useMemo(() => displayStudiesList(), [studiesList])}</div>
        </div>
      </main>
    </>
  );
}
