import React, { useEffect, useState } from 'react';
import NavBarSNCF from 'common/BootstrapSNCF/NavBarSNCF';
import logo from 'assets/pictures/views/study.svg';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Loader from 'common/Loader';
import nextId from 'react-id-generator';
import dayjs from 'dayjs';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import OptionsSNCF from 'common/BootstrapSNCF/OptionsSNCF';
import ScenarioCard from 'applications/osrd/components/Study/ScenarioCard';
import {
  projectJSON,
  scenariosListJSON,
  studyJSON,
} from 'applications/osrd/components/Helpers/genFakeDataForProjects';

dayjs.locale('fr');

function BreadCrumbs(props) {
  const { t } = useTranslation('osrd/project');
  const { projectName, studyName } = props;
  return (
    <div className="navbar-breadcrumbs">
      <Link to="/osrd">{t('projectsList')}</Link>
      <i className="icons-arrow-next icons-size-x75 text-muted" />
      <Link to="/osrd/project">{projectName}</Link>
      <i className="icons-arrow-next icons-size-x75 text-muted" />
      {studyName}
    </div>
  );
}

export default function Study() {
  const { t } = useTranslation('osrd/study');
  const [projectDetails, setProjectDetails] = useState();
  const [studyDetails, setStudyDetails] = useState();
  const [scenariosList, setScenariosList] = useState();
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
    setStudyDetails(studyJSON());
    setScenariosList(scenariosListJSON());
  }, []);
  return (
    <>
      <NavBarSNCF
        appName={
          <BreadCrumbs
            projectName={projectDetails ? projectDetails.name : null}
            studyName={studyDetails ? studyDetails.name : null}
          />
        }
        logo={logo}
      />
      <main className="mastcontainer mastcontainer-no-mastnav">
        <div className="p-3">
          {projectDetails && studyDetails ? (
            <>
              <div className="study-project-details">
                <div className="study-project-details-img">
                  <img src={projectDetails.image} alt="project logo" />
                </div>
                <div className="study-project-details-name">{projectDetails.name}</div>
              </div>

              <div className="study-details">
                <div className="row">
                  <div className="col-xl-8">
                    <div className="study-details-name">{studyDetails.name}</div>
                    <div className="study-details-type">{studyDetails.type}</div>
                    <div className="study-details-description">{studyDetails.description}</div>
                  </div>
                  <div className="col-xl-4">
                    <div className="study-details-dates">
                      <div className="study-details-dates-date">
                        <span className="mr-1">{t('modifiedOn')}</span>
                        {dayjs(studyDetails.lastModifiedDate)
                          .format('D MMM YYYY HH:mm')
                          .replace(/\./gi, '')}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="study-details-financials">
                  <div className="study-details-financials-infos">
                    <div className="study-details-financials-infos-item">
                      <h3>{t('geremiCode')}</h3>
                      <div>{studyDetails.geremiCode}</div>
                    </div>
                    <div className="study-details-financials-infos-item">
                      <h3>{t('affairCode')}</h3>
                      <div>{studyDetails.affairCode}</div>
                    </div>
                  </div>
                  <div className="study-details-financials-amount">
                    <span className="study-details-financials-amount-text">{t('budget')}</span>
                    {new Intl.NumberFormat('fr-FR', {
                      style: 'currency',
                      currency: 'EUR',
                      maximumSignificantDigits: 2,
                    }).format(studyDetails.budget)}
                  </div>
                </div>

                <div className="study-details-footer">
                  <div className="study-details-tags">
                    {studyDetails.tags.map((tag) => (
                      <div className="study-details-tags-tag" key={nextId()}>
                        {tag}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <span className="mt-5">
              <Loader position="center" />
            </span>
          )}

          <div className="scenarios-toolbar">
            <div className="">{`${scenariosList ? scenariosList.length : 0} ${t(
              'scenariosCount'
            )}`}</div>
            <div className="flex-grow-1">
              <InputSNCF
                type="text"
                id="scenarios-filter"
                name="scenarios-filter"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder={t('filterPlaceholder')}
                whiteBG
                noMargin
                unit={<i className="icons-search" />}
                sm
              />
            </div>
            <OptionsSNCF
              name="projects-sort-filter"
              onChange={handleSortOptions}
              selectedValue={sortOption}
              options={sortOptions}
              sm
            />
            <button className="btn btn-primary btn-sm" type="button">
              <i className="icons-add" />
              <span className="ml-2">{t('createScenario')}</span>
            </button>
          </div>

          <div className="scenarios-list">
            {scenariosList ? (
              <div className="row">
                {scenariosList.map((details) => (
                  <div className="col-xl-4 col-lg-6" key={nextId()}>
                    <ScenarioCard details={details} />
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
