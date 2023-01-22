import React, { useEffect, useState } from 'react';
import NavBarSNCF from 'common/BootstrapSNCF/NavBarSNCF';
import logo from 'assets/pictures/home/operationalStudies.svg';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import Timetable from 'applications/operationalStudies/components/Scenario/Timetable';
import infraLogo from 'assets/pictures/components/tracks.svg';
import ScenarioLoader from 'applications/operationalStudies/components/Scenario/ScenarioLoader';
import { useSelector, useDispatch } from 'react-redux';
import { MODES } from 'applications/operationalStudies/consts';
import { updateMode } from 'reducers/osrdconf';
import SimulationResults from './SimulationResults';
import { projectJSON, scenarioJSON, studyJSON } from '../components/Helpers/genFakeDataForProjects';
import ManageTrainSchedule from './ManageTrainSchedule';

function BreadCrumbs(props) {
  const { t } = useTranslation('operationalStudies/project');
  const { projectName, studyName, scenarioName } = props;
  return (
    <div className="navbar-breadcrumbs">
      <Link to="/operational-studies">{t('projectsList')}</Link>
      <i className="icons-arrow-next icons-size-x75 text-muted" />
      <Link to="/operational-studies/project">{projectName}</Link>
      <i className="icons-arrow-next icons-size-x75 text-muted" />
      <Link to="/operational-studies/study">{studyName}</Link>
      <i className="icons-arrow-next icons-size-x75 text-muted" />
      {scenarioName}
    </div>
  );
}

export default function Scenario() {
  const dispatch = useDispatch();
  const { t } = useTranslation('operationalStudies/scenario');
  const isUpdating = useSelector((state) => state.osrdsimulation.isUpdating);
  const [projectDetails, setProjectDetails] = useState();
  const [studyDetails, setStudyDetails] = useState();
  const [scenarioDetails, setScenarioDetails] = useState();
  const [displayTrainScheduleManagement, setDisplayTrainScheduleManagement] = useState(false);

  useEffect(() => {
    setProjectDetails(projectJSON());
    setStudyDetails(studyJSON());
    setScenarioDetails(scenarioJSON());
    dispatch(updateMode(MODES.simulation));
  }, []);
  return (
    <>
      <NavBarSNCF
        appName={
          <BreadCrumbs
            projectName={projectDetails ? projectDetails.name : null}
            studyName={studyDetails ? studyDetails.name : null}
            scenarioName={scenarioDetails ? scenarioDetails.name : null}
          />
        }
        logo={logo}
      />
      <main className="mastcontainer mastcontainer-no-mastnav">
        <div className="scenario">
          {isUpdating && <ScenarioLoader msg={t('isUpdating')} />}
          <div className="row">
            <div className="col-lg-4">
              <div className="scenario-sidemenu">
                {scenarioDetails && (
                  <div className="scenario-details">
                    <div className="scenario-details-name">{scenarioDetails.name}</div>
                    <div className="scenario-details-infra-name">
                      <img src={infraLogo} alt="Infra logo" className="mr-2" />
                      {scenarioDetails.infra_name}
                    </div>
                    <div className="scenario-details-description">
                      {scenarioDetails.description}
                    </div>
                  </div>
                )}
                <Timetable setDisplayTrainScheduleManagement={setDisplayTrainScheduleManagement} />
              </div>
            </div>
            <div className="col-lg-8">
              {displayTrainScheduleManagement && (
                <div className="scenario-managetrainschedule">
                  <ManageTrainSchedule
                    setDisplayTrainScheduleManagement={setDisplayTrainScheduleManagement}
                  />
                </div>
              )}
              <div className="scenario-results">
                <SimulationResults />
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
