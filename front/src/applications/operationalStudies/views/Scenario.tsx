import React, { useEffect, useState } from 'react';
import NavBarSNCF from 'common/BootstrapSNCF/NavBarSNCF';
import logo from 'assets/pictures/home/operationalStudies.svg';
import { useTranslation } from 'react-i18next';
import Timetable from 'applications/operationalStudies/components/Scenario/Timetable';
import infraLogo from 'assets/pictures/components/tracks.svg';
import ScenarioLoader from 'applications/operationalStudies/components/Scenario/ScenarioLoader';
import { useSelector, useDispatch } from 'react-redux';
import { MODES, MANAGE_TRAIN_SCHEDULE_TYPES } from 'applications/operationalStudies/consts';
import { updateInfraID, updateMode, updateTimetableID } from 'reducers/osrdconf';
import TimetableManageTrainSchedule from 'applications/operationalStudies/components/Scenario/TimetableManageTrainSchedule';
import BreadCrumbs from 'applications/operationalStudies/components/BreadCrumbs';
import {
  getProjectID,
  getScenarioID,
  getStudyID,
  getTimetableID,
} from 'reducers/osrdconf/selectors';
import { useModal } from 'common/BootstrapSNCF/ModalSNCF';
import { FaEye, FaEyeSlash, FaPencilAlt } from 'react-icons/fa';
import { GiElectric } from 'react-icons/gi';
import { setSuccess } from 'reducers/main';
import { useNavigate } from 'react-router-dom';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { RootState } from 'reducers';
import AddAndEditScenarioModal from '../components/Scenario/AddOrEditScenarioModal';
import getTimetable from '../components/Scenario/getTimetable';
import ImportTrainSchedule from './ImportTrainSchedule';
import ManageTrainSchedule from './ManageTrainSchedule';
import SimulationResults from './SimulationResults';

export default function Scenario() {
  const dispatch = useDispatch();
  const { t } = useTranslation('operationalStudies/scenario');
  const isUpdating = useSelector((state: RootState) => state.osrdsimulation.isUpdating);
  const [displayTrainScheduleManagement, setDisplayTrainScheduleManagement] = useState<string>(
    MANAGE_TRAIN_SCHEDULE_TYPES.none
  );
  const [trainsWithDetails, setTrainsWithDetails] = useState(false);
  const [collapsedTimetable, setCollapsedTimetable] = useState(false);

  const [getProject, { data: project }] =
    osrdEditoastApi.endpoints.getProjectsByProjectId.useLazyQuery({});
  const [getStudy, { data: study }] =
    osrdEditoastApi.endpoints.getProjectsByProjectIdStudiesAndStudyId.useLazyQuery({});
  const [getScenario, { data: scenario }] =
    osrdEditoastApi.endpoints.getProjectsByProjectIdStudiesAndStudyIdScenariosScenarioId.useLazyQuery(
      {}
    );

  const { openModal } = useModal();
  const navigate = useNavigate();
  const projectId = useSelector(getProjectID);
  const studyId = useSelector(getStudyID);
  const scenarioId = useSelector(getScenarioID);
  const timetableId = useSelector(getTimetableID);

  const getScenarioTimetable = async (withNotification = false) => {
    if (projectId && studyId && scenarioId) {
      getScenario({ projectId, studyId, scenarioId })
        .unwrap()
        .then((result) => {
          dispatch(updateTimetableID(result.timetable_id));
          dispatch(updateInfraID(result.infra_id));

          const preferedTimetableId = result.timetable_id || timetableId;

          getTimetable(preferedTimetableId);
          if (withNotification) {
            dispatch(
              setSuccess({
                title: t('scenarioUpdated'),
                text: t('scenarioUpdatedDetails', { name: result.name }),
              })
            );
          }
        });
    }
  };

  useEffect(() => {
    if (!scenarioId || !studyId || !projectId) {
      navigate('/operational-studies/study');
    } else {
      getProject({ projectId });
      getStudy({ projectId, studyId });
      getScenarioTimetable();
      dispatch(updateMode(MODES.simulation));
    }
    return () => {
      dispatch(updateTimetableID(undefined));
      dispatch(updateInfraID(undefined));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return scenario ? (
    <>
      <NavBarSNCF
        appName={
          <BreadCrumbs
            projectName={project?.name}
            studyName={study?.name}
            scenarioName={scenario.name}
          />
        }
        logo={logo}
      />
      <main className="mastcontainer mastcontainer-no-mastnav">
        <div className="scenario">
          {isUpdating && <ScenarioLoader msg={t('isUpdating')} />}
          <div className="row">
            <div className={collapsedTimetable ? 'd-none' : 'col-lg-4'}>
              <div className="scenario-sidemenu">
                {scenario && (
                  <div className="scenario-details">
                    <div className="scenario-details-name">
                      <span className="flex-grow-1">{scenario.name}</span>
                      <button
                        className="scenario-details-modify-button"
                        type="button"
                        onClick={() =>
                          openModal(
                            <AddAndEditScenarioModal
                              editionMode
                              scenario={scenario}
                              getScenarioTimetable={getScenarioTimetable}
                            />
                          )
                        }
                      >
                        <FaPencilAlt />
                      </button>
                      <button
                        type="button"
                        className="scenario-details-modify-button"
                        onClick={() => setTrainsWithDetails(!trainsWithDetails)}
                        title={t('displayTrainsWithDetails')}
                      >
                        {trainsWithDetails ? <FaEyeSlash /> : <FaEye />}
                      </button>
                      <button
                        type="button"
                        className="scenario-details-modify-button"
                        onClick={() => setCollapsedTimetable(true)}
                      >
                        <i className="icons-arrow-prev" />
                      </button>
                    </div>
                    <div className="row">
                      <div className="col-md-6">
                        <div className="scenario-details-infra-name">
                          <img src={infraLogo} alt="Infra logo" className="mr-2" />
                          {scenario.infra_name}
                          <small className="ml-auto text-muted">ID {scenario.infra_id}</small>
                        </div>
                      </div>
                      <div className="col-md-6">
                        <div className="scenario-details-electrical-profile-set">
                          <span className="mr-2">
                            <GiElectric />
                          </span>
                          {scenario.electrical_profile_set_name
                            ? scenario.electrical_profile_set_name
                            : t('noElectricalProfileSet')}
                        </div>
                      </div>
                    </div>
                    <div className="scenario-details-description">{scenario.description}</div>
                  </div>
                )}
                {displayTrainScheduleManagement !== MANAGE_TRAIN_SCHEDULE_TYPES.none && (
                  <TimetableManageTrainSchedule
                    displayTrainScheduleManagement={displayTrainScheduleManagement}
                    setDisplayTrainScheduleManagement={setDisplayTrainScheduleManagement}
                  />
                )}
                <Timetable
                  setDisplayTrainScheduleManagement={setDisplayTrainScheduleManagement}
                  trainsWithDetails={trainsWithDetails}
                />
              </div>
            </div>
            <div className={collapsedTimetable ? 'col-lg-12' : 'col-lg-8'}>
              {(displayTrainScheduleManagement === MANAGE_TRAIN_SCHEDULE_TYPES.add ||
                displayTrainScheduleManagement === MANAGE_TRAIN_SCHEDULE_TYPES.edit) && (
                <div className="scenario-managetrainschedule">
                  <ManageTrainSchedule />
                </div>
              )}
              {displayTrainScheduleManagement === MANAGE_TRAIN_SCHEDULE_TYPES.import && (
                <div className="scenario-managetrainschedule">
                  <ImportTrainSchedule />
                </div>
              )}
              <div className="scenario-results">
                {collapsedTimetable && (
                  <div className="scenario-timetable-collapsed">
                    <button
                      className="timetable-collapse-button"
                      type="button"
                      onClick={() => setCollapsedTimetable(false)}
                    >
                      <i className="icons-arrow-next" />
                    </button>
                    <div className="lead ml-2">{scenario.name}</div>
                    <div className="d-flex align-items-center ml-auto">
                      <img src={infraLogo} alt="Infra logo" className="mr-2" height="16" />
                      {scenario.infra_name}
                    </div>
                    <div className="d-flex align-items-center ml-4">
                      <span className="mr-1">
                        <GiElectric />
                      </span>
                      {scenario.electrical_profile_set_name
                        ? scenario.electrical_profile_set_name
                        : t('noElectricalProfileSet')}
                    </div>
                  </div>
                )}
                <SimulationResults
                  isDisplayed={
                    displayTrainScheduleManagement !== MANAGE_TRAIN_SCHEDULE_TYPES.import
                  }
                  collapsedTimetable={collapsedTimetable}
                />
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  ) : null;
}
