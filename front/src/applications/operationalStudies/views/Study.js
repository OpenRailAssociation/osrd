import React, { useContext, useEffect, useMemo, useState } from 'react';
import NavBarSNCF from 'common/BootstrapSNCF/NavBarSNCF';
import logo from 'assets/pictures/views/study.svg';
import { useTranslation } from 'react-i18next';
import Loader from 'common/Loader';
import nextId from 'react-id-generator';
import OptionsSNCF from 'common/BootstrapSNCF/OptionsSNCF';
import ScenarioCard from 'applications/operationalStudies/components/Study/ScenarioCard';
import { VscLink, VscFile, VscFiles } from 'react-icons/vsc';
import { FaPencilAlt, FaPlus } from 'react-icons/fa';
import { budgetFormat } from 'utils/numbers';
import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import { useSelector, useDispatch } from 'react-redux';
import { getProjectID, getStudyID } from 'reducers/osrdconf/selectors';
import { get } from 'common/requests';
import { setSuccess } from 'reducers/main';
import DateBox from 'applications/operationalStudies/components/Study/DateBox';
import StateStep from 'applications/operationalStudies/components/Study/StateStep';
import FilterTextField from 'applications/operationalStudies/components/FilterTextField';
import { PROJECTS_URI, SCENARIOS_URI, STUDIES_URI } from '../components/operationalStudiesConsts';
import AddAndEditScenarioModal from '../components/Scenario/AddAndEditScenarioModal';
import AddAndEditStudyModal from '../components/Study/AddAndEditStudyModal';
import BreadCrumbs from '../components/BreadCrumbs';

function displayScenariosList(scenariosList) {
  return scenariosList ? (
    <div className="row no-gutters">
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
  );
}

export default function Study() {
  const { t } = useTranslation('operationalStudies/study');
  const { openModal } = useContext(ModalContext);
  const [projectDetails, setProjectDetails] = useState();
  const [studyDetails, setStudyDetails] = useState();
  const [scenariosList, setScenariosList] = useState();
  const [filter, setFilter] = useState('');
  const [sortOption, setSortOption] = useState('-last_modification');
  const dispatch = useDispatch();
  const projectID = useSelector(getProjectID);
  const studyID = useSelector(getStudyID);

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
  const getStudyDetail = async (withNotification = false) => {
    try {
      const result = await get(`${PROJECTS_URI}${projectID}${STUDIES_URI}${studyID}/`);
      setStudyDetails(result);
      if (withNotification) {
        dispatch(
          setSuccess({
            title: t('studyUpdated'),
            text: t('studyUpdatedDetails', { name: studyDetails.name }),
          })
        );
      }
    } catch (error) {
      console.error(error);
    }
  };

  const getScenarioList = async () => {
    try {
      const params = {
        ordering: sortOption,
        name: filter,
        description: filter,
        tag: filter,
      };
      const data = await get(
        `${PROJECTS_URI}${projectID}${STUDIES_URI}${studyID}${SCENARIOS_URI}`,
        params
      );
      setScenariosList(data.results);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    getProjectDetail();
    getStudyDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    getScenarioList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortOption, filter]);

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
                  <div className="study-details-name">
                    {studyDetails.name}
                    <button
                      className="study-details-modify-button"
                      type="button"
                      onClick={() =>
                        openModal(
                          <AddAndEditStudyModal
                            editionMode
                            details={studyDetails}
                            getStudyDetail={getStudyDetail}
                          />,
                          'xl'
                        )
                      }
                    >
                      <span className="study-details-modify-button-text">{t('modifyStudy')}</span>
                      <FaPencilAlt />
                    </button>
                  </div>
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
              <FilterTextField setFilter={setFilter} id="scenarios-filter" sm />
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
            {useMemo(() => displayScenariosList(scenariosList), [scenariosList])}
          </div>
        </div>
      </main>
    </>
  );
}
