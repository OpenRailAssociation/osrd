import React, { useEffect, useState } from 'react';

import { useTranslation } from 'react-i18next';
import { MdTrain } from 'react-icons/md';
import { useSelector } from 'react-redux';

import infraIcon from 'assets/pictures/components/tracks.svg';
import scenarioIcon from 'assets/pictures/home/operationalStudies.svg';
import projectIcon from 'assets/pictures/views/projects.svg';
import studyIcon from 'assets/pictures/views/study.svg';
import { getDocument } from 'common/api/documentApi';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import type { TrainScheduleSummary } from 'common/api/osrdEditoastApi';
import { useModal } from 'common/BootstrapSNCF/ModalSNCF';
import { useOsrdConfActions, useOsrdConfSelectors } from 'common/osrdContext';
import { useAppDispatch } from 'store';

import ScenarioExplorerModal, { type ScenarioExplorerProps } from './ScenarioExplorerModal';

const ScenarioExplorer = ({
  globalProjectId,
  globalStudyId,
  globalScenarioId,
}: ScenarioExplorerProps) => {
  const { t } = useTranslation('common/scenarioExplorer');
  const dispatch = useAppDispatch();
  const { openModal } = useModal();
  const { getTimetableID } = useOsrdConfSelectors();
  const timetableID = useSelector(getTimetableID);
  const [imageUrl, setImageUrl] = useState<string>();

  const { data: projectDetails } = osrdEditoastApi.endpoints.getProjectsByProjectId.useQuery(
    { projectId: globalProjectId as number },
    { skip: !globalProjectId }
  );

  const { data: studyDetails } =
    osrdEditoastApi.endpoints.getProjectsByProjectIdStudiesAndStudyId.useQuery(
      { projectId: globalProjectId as number, studyId: globalStudyId as number },
      { skip: !globalProjectId && !globalStudyId }
    );

  const { data: scenarioDetails } =
    osrdEditoastApi.endpoints.getProjectsByProjectIdStudiesAndStudyIdScenariosScenarioId.useQuery(
      {
        projectId: globalProjectId as number,
        studyId: globalStudyId as number,
        scenarioId: globalScenarioId as number,
      },
      { skip: !globalProjectId && !globalStudyId && !globalScenarioId }
    );

  const { data: timetable } = osrdEditoastApi.endpoints.getTimetableById.useQuery(
    { id: timetableID as number },
    { skip: !timetableID }
  );

  const { updateInfraID, updateTimetableID } = useOsrdConfActions();

  const getProjectImage = async (imageId: number) => {
    try {
      const blobImage = await getDocument(imageId);
      setImageUrl(URL.createObjectURL(blobImage));
    } catch (error) {
      console.error(error);
    }
  };

  const validTrainCount = (trains: TrainScheduleSummary[]): number => {
    const validTrains = trains.filter(
      (train) => train.invalid_reasons && train.invalid_reasons.length === 0
    );
    return validTrains.length;
  };

  useEffect(() => {
    if (scenarioDetails?.timetable_id) {
      dispatch(updateTimetableID(scenarioDetails.timetable_id));
      dispatch(updateInfraID(scenarioDetails.infra_id));
    }
  }, [scenarioDetails]);

  useEffect(() => {
    if (projectDetails?.image) {
      getProjectImage(projectDetails?.image);
    } else {
      setImageUrl(undefined);
    }
  }, [projectDetails]);

  return (
    <div
      className="scenario-explorator-card"
      data-testid="scenario-explorator"
      onClick={() => {
        openModal(
          <ScenarioExplorerModal
            globalProjectId={globalProjectId}
            globalStudyId={globalStudyId}
            globalScenarioId={globalScenarioId}
          />,
          'lg'
        );
      }}
      role="button"
      tabIndex={0}
    >
      {globalProjectId &&
      projectDetails &&
      globalStudyId &&
      studyDetails &&
      globalScenarioId &&
      scenarioDetails ? (
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
              <div className="scenario-explorator-card-head-project">
                <span className="text-truncate" title={projectDetails.name}>
                  {projectDetails.name}
                </span>
              </div>
            </div>
            <div className="scenario-explorator-card-head-content-item">
              <img src={studyIcon} alt="study icon" />
              <span className="scenario-explorator-card-head-legend">{t('studyLegend')}</span>
              <div className="scenario-explorator-card-head-study">
                <span className="text-truncate" title={studyDetails.name}>
                  {studyDetails.name}
                </span>
              </div>
            </div>
            <div className="scenario-explorator-card-head-content-item">
              <img src={scenarioIcon} alt="scenario icon" />
              <span className="scenario-explorator-card-head-legend">{t('scenarioLegend')}</span>
              <div className="scenario-explorator-card-head-scenario">
                <span className="text-truncate" title={scenarioDetails.name}>
                  {scenarioDetails.name}
                </span>
                {timetable && (
                  <span className="scenario-explorator-card-head-scenario-traincount">
                    {validTrainCount(timetable.train_schedule_summaries)}
                    <MdTrain />
                  </span>
                )}
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
};

export default ScenarioExplorer;
