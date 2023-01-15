import React, { useEffect, useState } from 'react';
import NavBarSNCF from 'common/BootstrapSNCF/NavBarSNCF';
import logo from 'assets/pictures/home/operationalStudies.svg';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import Timetable from 'applications/operationalStudies/components/Scenario/Timetable';
import InfraSelector from 'common/InfraSelector/InfraSelector';
import OSRDSimulation from './OSRDSimulation/OSRDSimulation';
import { projectJSON, scenarioJSON, studyJSON } from '../components/Helpers/genFakeDataForProjects';

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
  const [projectDetails, setProjectDetails] = useState();
  const [studyDetails, setStudyDetails] = useState();
  const [scenarioDetails, setScenarioDetails] = useState();

  useEffect(() => {
    setProjectDetails(projectJSON());
    setStudyDetails(studyJSON());
    setScenarioDetails(scenarioJSON());
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
        <div className="p-3">
          {scenarioDetails && (
            <div className="scenario-details">
              <div className="scenario-details-name">{scenarioDetails.name}</div>
              <div className="scenario-details-description">{scenarioDetails.description}</div>
              <InfraSelector />
            </div>
          )}
          <div className="row">
            <div className="col-lg-4">
              <div className="scenario-timetable">
                <Timetable />
              </div>
            </div>
            <div className="col-lg-8">
              <OSRDSimulation />
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
