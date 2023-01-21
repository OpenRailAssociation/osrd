import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import ModalSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalSNCF';
import ModalBodySNCF from 'common/BootstrapSNCF/ModalSNCF/ModalBodySNCF';
import Map from 'applications/opendata/components/Map';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { getRollingStockID, getInfraID, getTimetableID } from 'reducers/osrdconf/selectors';
import generatePathfindingPayload from 'applications/opendata/components/generatePathfindingPayload';
import generateTrainSchedulesPayload from 'applications/opendata/components/generateTrainSchedulesPayload';
import { post } from 'common/requests';
import { scheduleURL } from 'applications/operationalStudies/components/SimulationResults/simulationResultsConsts';
import { initialViewport, initialStatus, itineraryURI } from 'applications/opendata/consts';
import OpenDataImportModalFooter from './OpenDataImportModalFooter';
import { refactorUniquePaths } from '../components/OpenDataHelpers';

/* METHOD
 *
 * 1: complete data in interactive way, proposing user to select position of each point/OP
 *   OR automatically use pathfindin/op endpoint to choose a path
 * 2: generate missing paths with new datas (or skipped part if automatically generated in phase 1)
 * 3: calculate trainSchedules and add them to the selected timetable
 * 4: two links come visible: stdcm or simulation
 *
 */

export default function OpenDataImportModal(props) {
  const { rollingStockDB, setMustUpdateTimetable, trains } = props;
  const { t } = useTranslation('translation', 'opendata');
  const infraID = useSelector(getInfraID);
  const rollingStockID = useSelector(getRollingStockID);
  const timetableID = useSelector(getTimetableID);

  const [trainsWithPathRef, setTrainsWithPathRef] = useState([]);

  // Places, points, OPs to add track section id
  const [pointsDictionnary, setPointsDictionnary] = useState();
  const [clickedFeature, setClickedFeature] = useState();
  const [uicNumberToComplete, setUicNumberToComplete] = useState();

  // Path to compute
  const [pathsDictionnary, setPathsDictionnary] = useState();

  const [whatIAmDoingNow, setWhatIAmDoingNow] = useState(t('opendata:status.ready'));

  const [viewport, setViewport] = useState(initialViewport);
  const [status, setStatus] = useState(initialStatus);

  function testMissingInfos() {
    const messages = [];
    if (!infraID) messages.push(t('opendata:status.missingInfra'));
    if (!rollingStockID) messages.push(t('opendata:status.missingRollingStock'));
    if (!timetableID) messages.push(t('opendata:status.missingTimetable'));
    if (messages.length > 0) {
      setWhatIAmDoingNow(
        <span className="text-danger">
          {[t('opendata:status.noImportationPossible'), ''].concat(messages).join('\n')}
        </span>
      );
    } else {
      setWhatIAmDoingNow(t('opendata:status.ready'));
    }
  }

  function getTrackSectionID(lat, lng) {
    setViewport({
      ...viewport,
      latitude: Number(lat),
      longitude: Number(lng),
      pitch: 0,
      bearing: 0,
      zoom: 18,
    });
  }

  //
  // 1 COMPLETE DATA INTERACTIVE WAY
  //

  function completePaths(init = false) {
    if (init) {
      setStatus(initialStatus);
      setUicNumberToComplete(undefined);
    }
    const uic2complete = Object.keys(pointsDictionnary);
    const uicNumberToCompleteLocal =
      uicNumberToComplete === undefined || init ? 0 : uicNumberToComplete + 1;
    if (uicNumberToCompleteLocal < uic2complete.length) {
      setUicNumberToComplete(uicNumberToCompleteLocal);
      getTrackSectionID(
        pointsDictionnary[uic2complete[uicNumberToCompleteLocal]].lat,
        pointsDictionnary[uic2complete[uicNumberToCompleteLocal]].lng
      );
      setWhatIAmDoingNow(
        `${uicNumberToCompleteLocal}/${uic2complete.length} ${t('opendata:status.complete')} ${
          pointsDictionnary[uic2complete[uicNumberToCompleteLocal]].name
        }`
      );
    } else {
      setWhatIAmDoingNow(t('opendata:status.uicComplete'));
      setUicNumberToComplete(undefined);
      setStatus({ ...status, uicComplete: true });
    }
  }

  //
  // 2 GENERATE PATHS (autocomplete to automatically look for OPs)
  //

  async function launchPathfinding(
    params,
    pathRefNum,
    pathNumberToComplete,
    pathsIDs,
    continuePath,
    autoComplete
  ) {
    try {
      const itineraryCreated = autoComplete
        ? await post(`${itineraryURI}op/`, params, {}, true)
        : await post(itineraryURI, params, {}, true);
      continuePath(
        pathNumberToComplete + 1,
        {
          ...pathsIDs,
          [pathRefNum]: { pathId: itineraryCreated.id, rollingStockId: params.rolling_stocks[0] },
        },
        autoComplete
      );
    } catch (e) {
      setWhatIAmDoingNow(
        <span className="text-danger">
          {t('opendata:errorMessages.unableToRetrievePathfinding')}
        </span>
      );
      setStatus(initialStatus);
      console.log('ERROR', e);
    }
  }

  function generatePaths(pathNumberToComplete = 0, pathsIDs = {}, autoComplete = false) {
    if (autoComplete && pathNumberToComplete === 0) {
      setStatus({ ...initialStatus, uicComplete: true });
      setUicNumberToComplete(undefined);
    }

    const pathfindingPayloads = generatePathfindingPayload(
      infraID,
      rollingStockID,
      trainsWithPathRef,
      pathsDictionnary,
      pointsDictionnary,
      rollingStockDB,
      autoComplete
    );

    const path2complete = Object.keys(pathfindingPayloads);
    if (pathNumberToComplete < path2complete.length) {
      setWhatIAmDoingNow(
        `${pathNumberToComplete}/${path2complete.length} ${t('opendata:status.searchingPath')} ${
          path2complete[pathNumberToComplete]
        }`
      );
      launchPathfinding(
        pathfindingPayloads[path2complete[pathNumberToComplete]],
        path2complete[pathNumberToComplete],
        pathNumberToComplete,
        pathsIDs,
        generatePaths,
        autoComplete
      );
    } else {
      setWhatIAmDoingNow(t('opendata:status.pathComplete'));
      setTrainsWithPathRef(
        trainsWithPathRef.map((train) => ({
          ...train,
          pathId: pathsIDs[train.pathRef].pathId,
          rollingStockId: pathsIDs[train.pathRef].rollingStockId,
        }))
      );
      setStatus({ ...status, uicComplete: true, pathFindingDone: true });
    }
  }

  //
  // 3 CALCULATE TRAINS SCHEDULES
  //

  async function launchTrainSchedules(params) {
    try {
      await post(scheduleURL, params, {});
      return `${t('opendata:status.calculatingTrainScheduleComplete')} (${params.path})`;
    } catch (error) {
      console.log(error);
    }
    return `${t('opendata:status.calculatingTrainScheduleError')} (${params.path})`;
  }
  async function generateTrainSchedules() {
    const payload = generateTrainSchedulesPayload(trainsWithPathRef, infraID, timetableID);
    setWhatIAmDoingNow(`${t('opendata:status.calculatingTrainSchedule')}`);
    const messages = [];
    const promisesList = [];
    // eslint-disable-next-line no-restricted-syntax
    for (const [idx, params] of Object.values(payload).entries()) {
      // eslint-disable-next-line no-await-in-loop
      const message = await launchTrainSchedules(params);
      promisesList.push(message);
      messages.push(`${message} ${idx + 1}/${Object.values(payload).length}`);
      setWhatIAmDoingNow(messages.join('\n'));
    }
    Promise.all(promisesList).then(() => {
      setStatus({ ...status, trainSchedulesDone: true });
      setMustUpdateTimetable(true);
      setWhatIAmDoingNow(t('opendata:status.calculatingTrainScheduleCompleteAll'));
    });
  }

  useEffect(() => {
    if (clickedFeature) {
      const actualUic = Object.keys(pointsDictionnary)[uicNumberToComplete];
      setPointsDictionnary({
        ...pointsDictionnary,
        [actualUic]: {
          ...pointsDictionnary[actualUic],
          trackSectionId: clickedFeature.properties.id,
        },
      });

      completePaths();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clickedFeature]);

  useEffect(() => {
    if (rollingStockDB && trains && trains.length > 0) {
      refactorUniquePaths(trains, setTrainsWithPathRef, setPathsDictionnary, setPointsDictionnary);
    }
  }, [trains, rollingStockDB]);

  useEffect(() => {
    testMissingInfos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [infraID, rollingStockID, timetableID]);

  return (
    <ModalSNCF htmlID="OpenDataImportModal">
      {pathsDictionnary && trainsWithPathRef.length > 0 ? (
        <ModalBodySNCF>
          {!infraID || !timetableID || !rollingStockID ? null : (
            <>
              <button
                className={`btn btn-sm btn-block d-flex justify-content-between ${
                  status.uicComplete ? 'btn-outline-success' : 'btn-primary'
                }`}
                type="button"
                onClick={() => completePaths(true)}
              >
                <span>1 — {t('opendata:completeTrackSectionID')}</span>
                <span>{Object.keys(pointsDictionnary).length}</span>
              </button>
              <div className="my-1 text-center">{t('opendata:or')}</div>
              <button
                className={`btn btn-sm btn-block d-flex justify-content-between text-wrap text-left ${
                  status.uicComplete || status.pathFindingDone
                    ? 'btn-outline-success'
                    : 'btn-primary'
                }`}
                type="button"
                onClick={() => generatePaths(0, {}, true)}
              >
                <span>1 — {t('opendata:generatePathsAuto')}</span>
                <span>{pathsDictionnary.length}</span>
              </button>
              <button
                className={`btn btn-sm btn-block d-flex justify-content-between ${
                  status.pathFindingDone ? 'btn-outline-success' : 'btn-primary'
                } ${status.uicComplete ? '' : 'disabled'}`}
                type="button"
                onClick={() => generatePaths(0)}
              >
                <span>2 — {t('opendata:generatePaths')}</span>
                <span>{pathsDictionnary.length}</span>
              </button>
              <button
                className={`btn btn-primary btn-sm btn-block d-flex justify-content-between ${
                  status.pathFindingDone ? '' : 'disabled'
                }`}
                type="button"
                onClick={generateTrainSchedules}
              >
                <span>3 — {t('opendata:generateTrainSchedules')}</span>
                <span>{trains.length}</span>
              </button>

              <hr />
            </>
          )}

          <pre>{whatIAmDoingNow}</pre>

          {uicNumberToComplete !== undefined ? (
            <div className="automated-map">
              <Map
                viewport={viewport}
                setViewport={setViewport}
                setClickedFeature={setClickedFeature}
              />
            </div>
          ) : null}
        </ModalBodySNCF>
      ) : (
        ''
      )}
      <OpenDataImportModalFooter status={status} />
    </ModalSNCF>
  );
}

OpenDataImportModal.defaultProps = {
  rollingStockDB: [],
};

OpenDataImportModal.propTypes = {
  trains: PropTypes.array.isRequired,
  rollingStockDB: PropTypes.array,
  setMustUpdateTimetable: PropTypes.func.isRequired,
};
