import React, { useEffect, useState } from 'react';
import NavBarSNCF from 'common/BootstrapSNCF/NavBarSNCF';
import logo from 'assets/pictures/home/osrd.svg';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import OSRDSimulation from './OSRDSimulation/OSRDSimulation';
import { projectJSON, scenarioJSON, studyJSON } from '../components/Helpers/genFakeDataForProjects';

function BreadCrumbs(props) {
  const { t } = useTranslation('osrd/project');
  const { projectName, studyName, scenarioName } = props;
  return (
    <div className="navbar-breadcrumbs">
      <Link to="/osrd">{t('projectsList')}</Link>
      <i className="icons-arrow-next icons-size-x75 text-muted" />
      <Link to="/osrd/project">{projectName}</Link>
      <i className="icons-arrow-next icons-size-x75 text-muted" />
      <Link to="/osrd/study">{studyName}</Link>
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
          <div className="row">
            <div className="col-lg-4">

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
