import React, { useEffect, useMemo, useState } from 'react';
import {
  PROJECTS_URI,
  SCENARIOS_URI,
  STUDIES_URI,
} from 'applications/operationalStudies/components/operationalStudiesConsts';
import projectsLogo from 'assets/pictures/views/projects.svg';
import scenarioExploratorLogo from 'assets/pictures/views/scenarioExplorator.svg';
import scenariosLogo from 'assets/pictures/views/scenarios.svg';
import studiesLogo from 'assets/pictures/views/studies.svg';
import ModalBodySNCF from 'common/BootstrapSNCF/ModalSNCF/ModalBodySNCF';
import ModalHeaderSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalHeaderSNCF';
import { get } from 'common/requests';
import { useTranslation } from 'react-i18next';
import { MdArrowRight } from 'react-icons/md';
import nextId from 'react-id-generator';
import { useSelector } from 'react-redux';
import { getProjectID, getScenarioID, getStudyID } from 'reducers/osrdconf/selectors';
import { ProjectResult, ScenarioListResult, StudyResult } from 'common/api/osrdEditoastApi';
import ProjectMiniCard from './ScenarioExploratorModalProjectMiniCard';
import ScenarioMiniCard from './ScenarioExploratorModalScenarioMiniCard';
import StudyMiniCard from './ScenarioExploratorModalStudyMiniCard';
import { FilterParams } from './ScenarioExploratorTypes';

export default function ScenarioExploratorModal() {
  const { t } = useTranslation('common/scenarioExplorator');

  const globalProjectID = useSelector(getProjectID);
  const globalStudyID = useSelector(getStudyID);
  const globalScenarioID = useSelector(getScenarioID);

  const [projectID, setProjectID] = useState<number | undefined>(globalProjectID);
  const [studyID, setStudyID] = useState<number | undefined>(globalStudyID);
  const [scenarioID, setScenarioID] = useState<number | undefined>(globalScenarioID);
  const [projectsList, setProjectsList] = useState<ProjectResult[]>();
  const [studiesList, setStudiesList] = useState<StudyResult[]>();
  const [scenariosList, setScenariosList] = useState<ScenarioListResult[]>();

  const grabItemsList = async (
    url: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setFunction: (arg0: any) => void,
    params?: FilterParams
  ) => {
    try {
      const data = await get(url, { params });
      setFunction(data.results);
    } catch (error) {
      /* empty */
    }
  };

  useEffect(() => {
    grabItemsList(PROJECTS_URI, setProjectsList, { ordering: 'NameAsc' });
  }, []);

  useEffect(() => {
    if (projectID) {
      grabItemsList(`${PROJECTS_URI}${projectID}${STUDIES_URI}`, setStudiesList, {
        ordering: 'NameAsc',
      });
    }
  }, [projectID]);

  useEffect(() => {
    setScenariosList(undefined);
  }, [studiesList]);

  useEffect(() => {
    if (projectID && studyID) {
      grabItemsList(
        `${PROJECTS_URI}${projectID}${STUDIES_URI}${studyID}${SCENARIOS_URI}`,
        setScenariosList,
        {
          ordering: 'NameAsc',
        }
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studyID]);

  return (
    <div className="scenario-explorator-modal">
      <ModalHeaderSNCF withCloseButton>
        <h1 className="scenario-explorator-modal-title">
          <img src={scenarioExploratorLogo} alt="Scenario explorator Logo" />
          {t('scenarioExplorator')}
        </h1>
      </ModalHeaderSNCF>
      <ModalBodySNCF>
        <div className="row">
          <div className="col-lg-4">
            <div className="scenario-explorator-modal-part projects">
              <div className="scenario-explorator-modal-part-title">
                <img src={projectsLogo} alt="projects logo" />
                <h2>{t('projects')}</h2>
                {projectsList && (
                  <span className="scenario-explorator-modal-part-title-count">
                    {projectsList.length}
                  </span>
                )}
              </div>
              <div className="scenario-explorator-modal-part-itemslist">
                {useMemo(
                  () =>
                    projectsList &&
                    projectsList.map((project) => (
                      <ProjectMiniCard
                        project={project}
                        setSelectedID={setProjectID}
                        isSelected={project.id === projectID}
                        key={nextId()}
                      />
                    )),
                  [projectsList, projectID]
                )}
              </div>
              <div className="scenario-explorator-modal-part-arrow">
                <MdArrowRight />
              </div>
            </div>
          </div>
          <div className="col-lg-4">
            <div className="scenario-explorator-modal-part studies">
              <div className="scenario-explorator-modal-part-title">
                <img src={studiesLogo} alt="studies logo" />
                <h2>{t('studies')}</h2>
                {studiesList && (
                  <span className="scenario-explorator-modal-part-title-count">
                    {studiesList.length}
                  </span>
                )}
              </div>
              <div className="scenario-explorator-modal-part-itemslist">
                {useMemo(
                  () =>
                    studiesList &&
                    studiesList.map((study) => (
                      <StudyMiniCard
                        study={study}
                        setSelectedID={setStudyID}
                        isSelected={study.id === studyID}
                        key={nextId()}
                      />
                    )),
                  [studiesList, studyID]
                )}
              </div>
              <div className="scenario-explorator-modal-part-arrow">
                <MdArrowRight />
              </div>
            </div>
          </div>
          <div className="col-lg-4">
            <div className="scenario-explorator-modal-part scenarios">
              <div className="scenario-explorator-modal-part-title">
                <img src={scenariosLogo} alt="scenarios logo" />
                <h2>{t('scenarios')}</h2>
                {scenariosList && (
                  <span className="scenario-explorator-modal-part-title-count">
                    {scenariosList.length}
                  </span>
                )}
              </div>
              <div className="scenario-explorator-modal-part-itemslist">
                {useMemo(
                  () =>
                    projectID &&
                    studyID &&
                    scenariosList &&
                    scenariosList.map((scenario) => (
                      <ScenarioMiniCard
                        scenario={scenario}
                        setSelectedID={setScenarioID}
                        isSelected={scenario.id === scenarioID}
                        projectID={projectID}
                        studyID={studyID}
                        key={nextId()}
                      />
                    )),
                  [scenariosList, scenarioID]
                )}
              </div>
            </div>
          </div>
        </div>
      </ModalBodySNCF>
    </div>
  );
}
