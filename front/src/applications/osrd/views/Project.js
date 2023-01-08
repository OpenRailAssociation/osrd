import React, { useEffect, useState } from 'react';
import NavBarSNCF from 'common/BootstrapSNCF/NavBarSNCF';
import logo from 'assets/pictures/views/studies.svg';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import nextId from 'react-id-generator';
import {
  projectJSON,
  studiesListJSON,
} from 'applications/osrd/components/Helpers/genFakeDataForProjects';
import StudyCard from 'applications/osrd/components/Project/StudyCard';
import Loader from 'common/Loader';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import OptionsSNCF from 'common/BootstrapSNCF/OptionsSNCF';
import { BiTargetLock } from 'react-icons/bi';

function BreadCrumbs(props) {
  const { t } = useTranslation('osrd/project');
  const { name } = props;
  return (
    <div className="navbar-breadcrumbs">
      <Link to="/osrd">{t('projectsList')}</Link>
      <i className="icons-arrow-next icons-size-x75 text-muted" />
      {name}
    </div>
  );
}

export default function Project() {
  const { t } = useTranslation('osrd/project');
  const [projectDetails, setProjectDetails] = useState();
  const [studiesList, setStudiesList] = useState();
  const [filter, setFilter] = useState('');
  const [sortOption, setSortOption] = useState('byName');

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

  const handleSortOptions = (e) => {
    setSortOption(e.target.value);
    console.log(e);
  };

  useEffect(() => {
    setProjectDetails(projectJSON());
    setStudiesList(studiesListJSON());
  }, []);

  return (
    <>
      <NavBarSNCF
        appName={<BreadCrumbs name={projectDetails ? projectDetails.name : null} />}
        logo={logo}
      />
      <main className="mastcontainer mastcontainer-no-mastnav">
        <div className="p-3">
          {projectDetails ? (
            <div className="project-details">
              <div className="project-details-title">
                <div className="row">
                  <div className="col-lg-4 col-md-4">
                    <div className="project-details-title-img">
                      <img src={projectDetails.image} alt="project logo" />
                    </div>
                  </div>
                  <div className="col-lg-8 col-md-8">
                    <div className="project-details-title-content">
                      <div className="project-details-title-name">{projectDetails.name}</div>
                      <div className="project-details-title-description">
                        {projectDetails.description}
                      </div>
                      <h3>
                        <span className="mr-2">
                          <BiTargetLock />
                        </span>
                        {t('objectives')}
                      </h3>
                      <div className="project-details-title-objectives">
                        {projectDetails.objectives}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="project-details-financials">
                <div className="project-details-financials-infos">
                  <h3>{t('fundedBy')}</h3>
                  <div>{projectDetails.financials}</div>
                </div>
                <div className="project-details-financials-amount">
                  <span className="project-details-financials-amount-text">{t('totalBudget')}</span>
                  {new Intl.NumberFormat('fr-FR', {
                    style: 'currency',
                    currency: 'EUR',
                    maximumSignificantDigits: 2,
                  }).format(projectDetails.budget)}
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
            <div className="h1 mb-0">{`${studiesList ? studiesList.length : 0} ${t(
              'studiesCount'
            )}`}</div>
            <div className="flex-grow-1">
              <InputSNCF
                type="text"
                name="projects-filter"
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
            <button className="btn btn-primary" type="button">
              <i className="icons-add" />
              <span className="ml-2">{t('createStudy')}</span>
            </button>
          </div>

          <div className="studies-list">
            {studiesList ? (
              <div className="row">
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
