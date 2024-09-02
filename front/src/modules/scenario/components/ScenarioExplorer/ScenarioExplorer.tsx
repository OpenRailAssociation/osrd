import { useEffect, useMemo, useState } from 'react';

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
import { useModal } from 'common/BootstrapSNCF/ModalSNCF';
import { LoaderFill } from 'common/Loaders';
import { useOsrdConfActions, useOsrdConfSelectors } from 'common/osrdContext';
import { getScenarioDatetimeWindow } from 'modules/scenario/helpers/utils';
import type { StdcmConfSliceActions } from 'reducers/osrdconf/stdcmConf';
import { useAppDispatch } from 'store';

import ScenarioExplorerModal, { type ScenarioExplorerProps } from './ScenarioExplorerModal';

const ScenarioExplorer = ({
  globalProjectId,
  globalStudyId,
  globalScenarioId,
  displayImgProject = true,
}: ScenarioExplorerProps & {
  displayImgProject?: boolean;
}) => {
  const { t } = useTranslation('common/scenarioExplorer');
  const dispatch = useAppDispatch();
  const { openModal } = useModal();
  const { getTimetableID } = useOsrdConfSelectors();
  const timetableID = useSelector(getTimetableID);
  const [imageUrl, setImageUrl] = useState<string>();

  const { updateStdcmEnvironment } = useOsrdConfActions() as StdcmConfSliceActions;
  const { data: projectDetails } = osrdEditoastApi.endpoints.getProjectsByProjectId.useQuery(
    { projectId: globalProjectId! },
    { skip: !globalProjectId }
  );

  const { data: studyDetails } =
    osrdEditoastApi.endpoints.getProjectsByProjectIdStudiesAndStudyId.useQuery(
      { projectId: globalProjectId!, studyId: globalStudyId! },
      { skip: !globalProjectId && !globalStudyId }
    );

  const { currentData: scenario } =
    osrdEditoastApi.endpoints.getProjectsByProjectIdStudiesAndStudyIdScenariosScenarioId.useQuery(
      {
        projectId: globalProjectId!,
        studyId: globalStudyId!,
        scenarioId: globalScenarioId!,
      },
      {
        skip: !globalProjectId || !globalStudyId || !globalScenarioId,
        refetchOnMountOrArgChange: true,
      }
    );

  const { data: timetable } = osrdEditoastApi.endpoints.getTimetableById.useQuery(
    { id: timetableID! },
    { skip: !timetableID }
  );

  const timetableTrainIds = useMemo(() => timetable?.train_ids, [timetable]);
  const { data: trainsDetails } = osrdEditoastApi.endpoints.postTrainSchedule.useQuery(
    {
      body: {
        ids: timetableTrainIds!,
      },
    },
    {
      skip: !timetable || !timetableTrainIds,
    }
  );

  const getProjectImage = async (imageId: number) => {
    try {
      const blobImage = await getDocument(imageId);
      setImageUrl(URL.createObjectURL(blobImage));
    } catch (error) {
      console.error(error);
    }
  };

  const trainCount = (trainIds: number[]) => trainIds.length;

  useEffect(() => {
    if (scenario) {
      const scenarioDateTimeWindow = getScenarioDatetimeWindow(trainsDetails);

      // We also set the stdcm environment in case we select a scenario from the stdcm interface.
      dispatch(
        updateStdcmEnvironment({
          infraID: scenario.infra_id,
          timetableID: scenario.timetable_id,
          electricalProfileSetId: undefined,
          workScheduleGroupId: undefined,
          searchDatetimeWindow: scenarioDateTimeWindow,
        })
      );
    }
  }, [scenario, trainsDetails]);

  useEffect(() => {
    if (projectDetails?.image) {
      getProjectImage(projectDetails?.image);
    } else {
      setImageUrl(undefined);
    }
  }, [projectDetails]);

  const showNoScenarioContent = () =>
    globalScenarioId && !scenario ? (
      <LoaderFill />
    ) : (
      <div className="scenario-explorator-card-noscenario">{t('noScenarioSelected')}</div>
    );

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

                <span className="scenario-explorator-card-head-scenario-traincount">
                  {timetable && trainCount(timetable.train_ids)}
                  <MdTrain />
                </span>
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
        showNoScenarioContent()
      )}
    </div>
  );
};

export default ScenarioExplorer;
