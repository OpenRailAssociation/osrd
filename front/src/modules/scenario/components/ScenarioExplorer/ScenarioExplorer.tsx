import React, { useEffect, useMemo, useState } from 'react';

import cx from 'classnames';
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
import { getStdcmV2Activated, getTrainScheduleV2Activated } from 'reducers/user/userSelectors';
import { useAppDispatch } from 'store';

import ScenarioExplorerModal, { type ScenarioExplorerProps } from './ScenarioExplorerModal';

const ScenarioExplorer = ({
  globalProjectId,
  globalStudyId,
  globalScenarioId,
  displayImgProject = true,
}: ScenarioExplorerProps & { displayImgProject?: boolean }) => {
  const { t } = useTranslation('common/scenarioExplorer');
  const dispatch = useAppDispatch();
  const { openModal } = useModal();
  const { getTimetableID } = useOsrdConfSelectors();
  const timetableID = useSelector(getTimetableID);
  const [imageUrl, setImageUrl] = useState<string>();
  const trainScheduleV2Activated = useSelector(getTrainScheduleV2Activated);
  const stdcmV2Activated = useSelector(getStdcmV2Activated);
  const useTrainScheduleV2 = trainScheduleV2Activated || stdcmV2Activated;

  const { updateInfraID, updateTimetableID, updateScenarioID } = useOsrdConfActions();
  const { data: projectDetails } = osrdEditoastApi.endpoints.getProjectsByProjectId.useQuery(
    { projectId: globalProjectId as number },
    { skip: !globalProjectId }
  );

  const { data: studyDetails } =
    osrdEditoastApi.endpoints.getProjectsByProjectIdStudiesAndStudyId.useQuery(
      { projectId: globalProjectId as number, studyId: globalStudyId as number },
      { skip: !globalProjectId && !globalStudyId }
    );

  const { data: scenarioV1 } =
    osrdEditoastApi.endpoints.getProjectsByProjectIdStudiesAndStudyIdScenariosScenarioId.useQuery(
      {
        projectId: globalProjectId as number,
        studyId: globalStudyId as number,
        scenarioId: globalScenarioId as number,
      },
      {
        skip: !globalProjectId || !globalStudyId || !globalScenarioId || useTrainScheduleV2,
      }
    );

  const { currentData: scenarioV2, isSuccess: isScenarioSuccess } =
    osrdEditoastApi.endpoints.getV2ProjectsByProjectIdStudiesAndStudyIdScenariosScenarioId.useQuery(
      {
        projectId: globalProjectId as number,
        studyId: globalStudyId as number,
        scenarioId: globalScenarioId as number,
      },
      {
        skip: !useTrainScheduleV2 || !globalProjectId || !globalStudyId || !globalScenarioId,
        refetchOnMountOrArgChange: true,
      }
    );

  const { data: timetable } = osrdEditoastApi.endpoints.getTimetableById.useQuery(
    { id: timetableID as number },
    { skip: !timetableID || useTrainScheduleV2 }
  );

  const { data: timetableV2 } = osrdEditoastApi.endpoints.getV2TimetableById.useQuery(
    { id: timetableID as number },
    { skip: !useTrainScheduleV2 || !timetableID }
  );

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

  const v2TrainCount = (trainIds: number[]) => trainIds.length;

  const scenario = useMemo(
    () => (useTrainScheduleV2 ? scenarioV2 : scenarioV1),
    [useTrainScheduleV2, scenarioV2, scenarioV1]
  );

  useEffect(() => {
    if (scenario) {
      dispatch(updateTimetableID(scenario.timetable_id));
      dispatch(updateInfraID(scenario.infra_id));
    }
  }, [scenario]);

  useEffect(() => {
    if (projectDetails?.image) {
      getProjectImage(projectDetails?.image);
    } else {
      setImageUrl(undefined);
    }
  }, [projectDetails]);

  useEffect(() => {
    if (!isScenarioSuccess && stdcmV2Activated) {
      dispatch(updateScenarioID(undefined));
    }
  }, [scenario, scenarioV2, isScenarioSuccess]);

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
      {globalProjectId && projectDetails && studyDetails && scenario ? (
        <div className="scenario-explorator-card-head">
          {displayImgProject && imageUrl && (
            <div className="scenario-explorator-card-head-img">
              <img src={imageUrl} alt="Project logo" />
            </div>
          )}
          <div
            className={cx('scenario-explorator-card-head-content', {
              'no-image': !imageUrl,
              'ml-0': !displayImgProject,
            })}
          >
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
                <span className="text-truncate" title={scenario.name}>
                  {scenario.name}
                </span>
                {useTrainScheduleV2 ? (
                  <span className="scenario-explorator-card-head-scenario-traincount">
                    {timetableV2 && v2TrainCount(timetableV2.train_ids)}
                    <MdTrain />
                  </span>
                ) : (
                  timetable && (
                    <span className="scenario-explorator-card-head-scenario-traincount">
                      {validTrainCount(timetable.train_schedule_summaries)}
                      <MdTrain />
                    </span>
                  )
                )}
              </div>
            </div>
            <div className="scenario-explorator-card-head-content-item">
              <img src={infraIcon} alt="infra icon" />
              <span className="scenario-explorator-card-head-legend">{t('infraLegend')}</span>
              <div className="scenario-explorator-card-head-infra">{scenario.infra_name}</div>
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
