import React, { useContext, useEffect, useState } from 'react';
import NavBarSNCF from 'common/BootstrapSNCF/NavBarSNCF';
import logo from 'assets/pictures/views/study.svg';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Loader from 'common/Loader';
import nextId from 'react-id-generator';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import OptionsSNCF from 'common/BootstrapSNCF/OptionsSNCF';
import ScenarioCard from 'applications/operationalStudies/components/Study/ScenarioCard';
import { VscLink, VscFile, VscFiles } from 'react-icons/vsc';
import { FaPlus } from 'react-icons/fa';
import {
  projectJSON,
  scenariosListJSON,
  studyJSON,
} from 'applications/operationalStudies/components/Helpers/genFakeDataForProjects';
import { budgetFormat } from 'utils/numbers';
import { dateTimeFrenchFormatting } from 'utils/date';
import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import { useSelector } from 'react-redux';
import { getProjectID, getStudyID } from 'reducers/osrdconf/selectors';
import { get } from 'common/requests';
import { PROJECTS_URI, SCENARIOS_URI, STUDIES_URI } from '../components/operationalStudiesConsts';
import AddAndEditScenarioModal from '../components/Scenario/AddAndEditScenarioModal';

function BreadCrumbs(props) {
  const { t } = useTranslation('operationalStudies/project');
  const { projectName, studyName } = props;
  return (
    <div className="navbar-breadcrumbs">
      <Link to="/operational-studies">{t('projectsList')}</Link>
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
      <span className="study-details-dates-date-value">{dateTimeFrenchFormatting(date)}</span>
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
  const { openModal } = useContext(ModalContext);
  const [projectDetails, setProjectDetails] = useState();
  const [studyDetails, setStudyDetails] = useState();
  const [scenariosList, setScenariosList] = useState();
  const [filter, setFilter] = useState('');
  const [sortOption, setSortOption] = useState('byName');
  const projectID = useSelector(getProjectID);
  const studyID = useSelector(getStudyID);

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
  };

  const getProjectDetail = async () => {
    try {
      const result = await get(`${PROJECTS_URI}${projectID}/`);
      setProjectDetails(result);
    } catch (error) {
      console.error(error);
    }
  };
  const getStudyDetail = async () => {
    try {
      const result = await get(`${PROJECTS_URI}${projectID}${STUDIES_URI}${studyID}/`);
      setStudyDetails(result);
    } catch (error) {
      console.error(error);
    }
  };

  const getScenarioList = async () => {
    try {
      const data = await get(`${PROJECTS_URI}${projectID}${STUDIES_URI}${studyID}${SCENARIOS_URI}`);
      setScenariosList(data.results);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    getProjectDetail();
    getStudyDetail();
    getScenarioList();
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
                <DateBox date={studyDetails.creation_date} css="creation" translation="creation" />
                <DateBox date={studyDetails.start_date} css="start" translation="start" />
                <DateBox
                  date={studyDetails.expected_end_date}
                  css="estimatedend"
                  translation="estimatedend"
                />
                <DateBox date={studyDetails.actual_end_date} css="realend" translation="realend" />
                <DateBox
                  date={studyDetails.last_modification}
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
                      <span className="ml-auto">
                        {studyDetails.files ? studyDetails.files.length : 0}
                      </span>
                    </div>
                    <div className="study-details-files-list">
                      {studyDetails.files &&
                        studyDetails.files.map((file) => {
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
                    <div>{studyDetails.service_code}</div>
                  </div>
                  <div className="study-details-financials-infos-item">
                    <h3>{t('affairCode')}</h3>
                    <div>{studyDetails.business_code}</div>
                  </div>
                </div>
                <div className="study-details-financials-amount">
                  <span className="study-details-financials-amount-text">{t('budget')}</span>
                  {budgetFormat(studyDetails.budget)}
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
            <div className="">
              {t('scenariosCount', { count: scenariosList ? scenariosList.length : 0 })}
            </div>
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
            <button
              className="btn btn-primary btn-sm"
              type="button"
              onClick={() => openModal(<AddAndEditScenarioModal />, 'xl')}
            >
              <FaPlus />
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
