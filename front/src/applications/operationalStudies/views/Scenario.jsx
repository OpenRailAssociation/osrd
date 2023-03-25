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
import { get } from 'common/requests';
import { useModal } from 'common/BootstrapSNCF/ModalSNCF';
import { FaPencilAlt } from 'react-icons/fa';
import { GiElectric } from 'react-icons/gi';
import { setSuccess } from 'reducers/main';
import { useNavigate } from 'react-router-dom';
import { PROJECTS_URI, SCENARIOS_URI, STUDIES_URI } from '../components/operationalStudiesConsts';
import AddAndEditScenarioModal from '../components/Scenario/AddOrEditScenarioModal';
import getTimetable from '../components/Scenario/getTimetable';
import ImportTrainSchedule from './ImportTrainSchedule';
import ManageTrainSchedule from './ManageTrainSchedule';
import SimulationResults from './SimulationResults';

export default function Scenario() {
  const dispatch = useDispatch();
  const { t } = useTranslation('operationalStudies/scenario');
  const isUpdating = useSelector((state) => state.osrdsimulation.isUpdating);
  const [project, setProject] = useState();
  const [study, setStudy] = useState();
  const [scenario, setScenario] = useState();
  const [trainScheduleIDToModify, setTrainScheduleIDToModify] = useState();
  const [displayTrainScheduleManagement, setDisplayTrainScheduleManagement] = useState(
    MANAGE_TRAIN_SCHEDULE_TYPES.none
  );
  const { openModal } = useModal();
  const navigate = useNavigate();
  const projectID = useSelector(getProjectID);
  const studyID = useSelector(getStudyID);
  const scenarioID = useSelector(getScenarioID);
  const timetableID = useSelector(getTimetableID);

  const getProject = async () => {
    try {
      const result = await get(`${PROJECTS_URI}${projectID}/`);
      setProject(result);
    } catch (error) {
      console.error(error);
    }
  };

  const getStudy = async () => {
    try {
      const result = await get(`${PROJECTS_URI}${projectID}${STUDIES_URI}${studyID}/`);
      setStudy(result);
    } catch (error) {
      console.error(error);
    }
  };

  const getScenario = async (withNotification = false) => {
    try {
      const result = await get(
        `${PROJECTS_URI}${projectID}${STUDIES_URI}${studyID}${SCENARIOS_URI}${scenarioID}/`
      );
      setScenario(result);
      dispatch(updateTimetableID(result.timetable_id));
      dispatch(updateInfraID(result.infra_id));

      const preferedTimetableID = result.timetable_id || timetableID;

      getTimetable(preferedTimetableID);
      if (withNotification) {
        dispatch(
          setSuccess({
            title: t('scenarioUpdated'),
            text: t('scenarioUpdatedDetails', { name: scenario.name }),
          })
        );
      }
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    if (!scenarioID || !studyID || !projectID) {
      navigate('/operational-studies/study');
    } else {
      getProject();
      getStudy();
      getScenario();
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
            projectName={project ? project.name : null}
            studyName={study ? study.name : null}
            scenarioName={scenario ? scenario.name : null}
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
                {scenario && (
                  <div className="scenario-details">
                    <div className="scenario-details-name">
                      {scenario.name}
                      <button
                        className="scenario-details-modify-button"
                        type="button"
                        onClick={() =>
                          openModal(
                            <AddAndEditScenarioModal
                              editionMode
                              scenario={scenario}
                              getScenario={getScenario}
                            />
                          )
                        }
                      >
                        <span className="scenario-details-modify-button-text">
                          {t('modifyScenario')}
                        </span>
                        <FaPencilAlt />
                      </button>
                    </div>
                    <div className="row">
                      <div className="col-md-6">
                        <div className="scenario-details-infra-name">
                          <img src={infraLogo} alt="Infra logo" className="mr-2" />
                          {scenario.infra_name}
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
                  setTrainScheduleIDToModify={setTrainScheduleIDToModify}
                />
              </div>
            </div>
            <div className="col-lg-8">
              {(displayTrainScheduleManagement === MANAGE_TRAIN_SCHEDULE_TYPES.add ||
                displayTrainScheduleManagement === MANAGE_TRAIN_SCHEDULE_TYPES.edit) && (
                <div className="scenario-managetrainschedule">
                  <ManageTrainSchedule
                    displayTrainScheduleManagement={displayTrainScheduleManagement}
                    setDisplayTrainScheduleManagement={setDisplayTrainScheduleManagement}
                    trainScheduleIDToModify={trainScheduleIDToModify}
                  />
                </div>
              )}
              {displayTrainScheduleManagement === MANAGE_TRAIN_SCHEDULE_TYPES.import && (
                <div className="scenario-managetrainschedule">
                  <ImportTrainSchedule />
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
  ) : null;
}
