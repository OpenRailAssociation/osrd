import { useEffect, useState } from 'react';

import cx from 'classnames';
import { useTranslation } from 'react-i18next';
import { MdTrain } from 'react-icons/md';

import infraIcon from 'assets/pictures/components/tracks.svg';
import scenarioIcon from 'assets/pictures/home/operationalStudies.svg';
import projectIcon from 'assets/pictures/views/projects.svg';
import studyIcon from 'assets/pictures/views/study.svg';
import { getDocument } from 'common/api/documentApi';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { useModal } from 'common/BootstrapSNCF/ModalSNCF';
import { LoaderFill } from 'common/Loaders';
import { getScenarioDatetimeWindow } from 'modules/scenario/helpers/utils';
import { updateStdcmEnvironment } from 'reducers/osrdconf/stdcmConf';
import { useAppDispatch } from 'store';

import ScenarioExplorerModal, { type ScenarioExplorerProps } from './ScenarioExplorerModal';

const ScenarioExplorer = ({
  globalProjectId,
  globalStudyId,
  globalScenarioId,
  displayImgProject = true,
  timetableId,
}: ScenarioExplorerProps & {
  displayImgProject?: boolean;
  timetableId: number | undefined;
}) => {
  const { t } = useTranslation('common/scenarioExplorer');
  const dispatch = useAppDispatch();
  const { openModal } = useModal();
  const [imageUrl, setImageUrl] = useState<string>();

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

  const { data: timetable } = osrdEditoastApi.endpoints.getAllTimetableByIdTrainSchedules.useQuery(
    { timetableId: timetableId! },
    {
      skip: !timetableId,
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

  useEffect(() => {
    if (scenario) {
      const scenarioDateTimeWindow = getScenarioDatetimeWindow(timetable);

      // We also set the stdcm environment in case we select a scenario from the stdcm interface.
      dispatch(
        updateStdcmEnvironment({
          infraID: scenario.infra_id,
          timetableID: scenario.timetable_id,
          electricalProfileSetId: scenario.electrical_profile_set_id,
          searchDatetimeWindow: scenarioDateTimeWindow,
        })
      );
    }
  }, [scenario, timetable]);

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
                  {timetable && timetable.length}
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
