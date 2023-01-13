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
import ScenarioCard from 'applications/operationalStudies/components/Study/ScenarioCard';
import { VscLink, VscFile, VscFiles } from 'react-icons/vsc';
import {
  projectJSON,
  scenariosListJSON,
  studyJSON,
} from 'applications/operationalStudies/components/Helpers/genFakeDataForProjects';

dayjs.locale('fr');

function BreadCrumbs(props) {
  const { t } = useTranslation('operationalStudies/project');
  const { projectName, studyName } = props;
  return (
    <div className="navbar-breadcrumbs">
      <Link to="/osrd">{t('projectsList')}</Link>
      <i className="icons-arrow-next icons-size-x75 text-muted" />
      <Link to="/operational-studies/project">{projectName}</Link>
      <i className="icons-arrow-next icons-size-x75 text-muted" />
      {studyName}
    </div>
  );
}

function DateBox(props) {
  const { t } = useTranslation('operationalStudies/study');
  const { date, css, translation } = props;
  return (
    <div className={`study-details-dates-date ${css}`}>
      <span className="study-details-dates-date-label">{t(`dates.${translation}`)}</span>
      <span className="study-details-dates-date-value">
        {dayjs(date).format('D MMM YYYY HH:mm').replace(/\./gi, '')}
      </span>
    </div>
  );
}

function StateStep(props) {
  const { number, label, done } = props;
  return (
    <div className={`study-details-state-step ${done ? 'done' : null}`}>
      <span className="study-details-state-step-number">{number}</span>
      <span className="study-details-state-step-label">{label}</span>
    </div>
  );
}

export default function Study() {
  const { t } = useTranslation('operationalStudies/study');
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
            <div className="study-details">
              <div className="study-details-dates">
                <DateBox date={studyDetails.creationDate} css="creation" translation="creation" />
                <DateBox date={studyDetails.startDate} css="start" translation="start" />
                <DateBox
                  date={studyDetails.estimatedEndingDate}
                  css="estimatedend"
                  translation="estimatedend"
                />
                <DateBox date={studyDetails.realEndingDate} css="realend" translation="realend" />
                <DateBox
                  date={studyDetails.lastModifiedDate}
                  css="modified"
                  translation="modified"
                />
              </div>
              <div className="row">
                <div className="col-xl-9 col-lg-8 col-md-7">
                  <div className="study-details-name">{studyDetails.name}</div>
                  <div className="study-details-type">{studyDetails.type}</div>
                  <div className="study-details-description">{studyDetails.description}</div>
                  <div className="study-details-state">
                    <StateStep number={1} label="Réception et analyse des besoins" done />
                    <StateStep number={2} label="Méthodologie pour l'étude" done />
                    <StateStep number={3} label="Devis" done />
                    <StateStep number={4} label="Cahier des hypothèses" done />
                    <StateStep number={5} label="Lancement de l'étude" />
                    <StateStep number={6} label="Contractualisation" />
                  </div>
                </div>
                <div className="col-xl-3 col-lg-4 col-md-5">
                  <div className="study-details-files">
                    <div className="study-details-files-title">
                      <span className="mr-2">
                        <VscFiles />
                      </span>
                      {t('filesAndLinks')}
                      <span className="ml-auto">{studyDetails.files.length}</span>
                    </div>
                    <div className="study-details-files-list">
                      {studyDetails.files.map((file) => {
                        const isUrl = Math.random() > 0.5;
                        return (
                          <a
                            href={file.url}
                            key={nextId()}
                            target="_blank"
                            rel="noreferrer"
                            className={isUrl ? 'url' : 'file'}
                          >
                            <span className="study-details-files-list-name">
                              <span className="mr-1">{isUrl ? <VscLink /> : <VscFile />}</span>
                              {file.name}
                            </span>
                            <span className="study-details-files-list-link">
                              {isUrl ? file.url : file.filename}
                            </span>
                          </a>
                        );
                      })}
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
