/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState } from 'react';
import { useModal } from 'common/BootstrapSNCF/ModalSNCF';
import {
  LEGACY_PROJECTS_URI,
  PROJECTS_URI,
  SCENARIOS_URI,
  STUDIES_URI,
} from 'applications/operationalStudies/components/operationalStudiesConsts';
import infraIcon from 'assets/pictures/components/tracks.svg';
import scenarioIcon from 'assets/pictures/home/operationalStudies.svg';
import projectIcon from 'assets/pictures/views/projects.svg';
import studyIcon from 'assets/pictures/views/study.svg';
import { get } from 'common/requests';
import { useTranslation } from 'react-i18next';
import { MdTrain } from 'react-icons/md';
import { useDispatch, useSelector } from 'react-redux';
import { updateInfraID, updateTimetableID } from 'reducers/osrdconf';
import { getProjectID, getScenarioID, getStudyID } from 'reducers/osrdconf/selectors';
import ScenarioExploratorModal from './ScenarioExploratorModal';

export default function ScenarioExplorator() {
  const { t } = useTranslation('common/scenarioExplorator');
  const dispatch = useDispatch();
  const { openModal } = useModal();
  const projectID = useSelector(getProjectID);
  const studyID = useSelector(getStudyID);
  const scenarioID = useSelector(getScenarioID);
  const [projectDetails, setProjectDetails] = useState<any>();
  const [studyDetails, setStudyDetails] = useState<any>();
  const [scenarioDetails, setScenarioDetails] = useState<any>();
  const [imageUrl, setImageUrl] = useState<string>();

  async function getDetails(url: string, setDetails: (arg0: any) => void) {
    try {
      const result = await get(url);
      setDetails(result);
    } catch (error) {
      console.error(error);
    }
  }

  const getProjectImage = async (url: string) => {
    try {
      const image = await get(url, { responseType: 'blob' });
      setImageUrl(URL.createObjectURL(image));
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    if (projectID && studyID && scenarioID) {
      getDetails(`${PROJECTS_URI}${projectID}/`, setProjectDetails);
      getDetails(`${LEGACY_PROJECTS_URI}${projectID}${STUDIES_URI}${studyID}/`, setStudyDetails);
      getDetails(
        `${LEGACY_PROJECTS_URI}${projectID}${STUDIES_URI}${studyID}${SCENARIOS_URI}${scenarioID}/`,
        setScenarioDetails
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenarioID]);

  useEffect(() => {
    if (scenarioDetails?.timetable) {
      dispatch(updateTimetableID(scenarioDetails.timetable));
      dispatch(updateInfraID(scenarioDetails.infra));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenarioDetails]);

  useEffect(() => {
    if (projectDetails?.image_url) {
      getProjectImage(`${PROJECTS_URI}${projectID}/image/`);
    } else {
      setImageUrl(undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectDetails]);

  return (
    <div
      className="scenario-explorator-card"
      data-testid="scenario-explorator"
      onClick={() => {
        openModal(<ScenarioExploratorModal />, 'lg');
      }}
      role="button"
      tabIndex={0}
    >
      {projectDetails && studyDetails && scenarioDetails ? (
        <div className="scenario-explorator-card-head">
          {imageUrl && (
            <div className="scenario-explorator-card-head-img">
              <img src={imageUrl} alt="Project logo" />
            </div>
          )}
          <div className={`scenario-explorator-card-head-content ${imageUrl ? '' : 'no-image'}`}>
            <div className="scenario-explorator-card-head-content-item">
              <img src={projectIcon} alt="project icon" />
              <span className="scenario-explorator-card-head-legend">{t('projectLegend')}</span>
              <div className="scenario-explorator-card-head-project">{projectDetails.name}</div>
            </div>
            <div className="scenario-explorator-card-head-content-item">
              <img src={studyIcon} alt="study icon" />
              <span className="scenario-explorator-card-head-legend">{t('studyLegend')}</span>
              <div className="scenario-explorator-card-head-study">{studyDetails.name}</div>
            </div>
            <div className="scenario-explorator-card-head-content-item">
              <img src={scenarioIcon} alt="scenario icon" />
              <span className="scenario-explorator-card-head-legend">{t('scenarioLegend')}</span>
              <div className="scenario-explorator-card-head-scenario">
                {scenarioDetails.name}
                <span className="scenario-explorator-card-head-scenario-traincount">
                  {scenarioDetails.trains_count}
                  <MdTrain />
                </span>
              </div>
            </div>
            <div className="scenario-explorator-card-head-content-item">
              <img src={infraIcon} alt="infra icon" />
              <span className="scenario-explorator-card-head-legend">{t('infraLegend')}</span>
              <div className="scenario-explorator-card-head-infra">
                {scenarioDetails.infra_name}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="scenario-explorator-card-noscenario">{t('noScenarioSelected')}</div>
      )}
    </div>
  );
}
