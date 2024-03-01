import React, { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { compact } from 'lodash';
import cx from 'classnames';

import {
  type TrainSchedule,
  type TrainScheduleWithPath,
  type TrainScheduleWithPathRef,
} from 'applications/operationalStudies/types';

import Map from 'modules/trainschedule/components/ImportTrainSchedule/Map';
import type { Point } from 'modules/trainschedule/components/ImportTrainSchedule/types';
import { refactorUniquePaths } from 'modules/trainschedule/components/ImportTrainSchedule/ImportTrainScheduleHelpers';
import generatePathfindingPayload from 'modules/trainschedule/components/ImportTrainSchedule/generatePathfindingPayload';
import generateTrainSchedulesPayload from 'modules/trainschedule/components/ImportTrainSchedule/generateTrainSchedulesPayload';
import {
  initialViewport,
  initialStatus,
} from 'modules/trainschedule/components/ImportTrainSchedule/consts';
import Spacer from 'common/Spacer';
import { useOsrdConfSelectors } from 'common/osrdContext';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import ModalBodySNCF from 'common/BootstrapSNCF/ModalSNCF/ModalBodySNCF';
import type {
  LightRollingStock,
  PathResponse,
  TrainScheduleBatchItem,
} from 'common/api/osrdEditoastApi';

import ImportTrainScheduleModalFooter from 'modules/trainschedule/components/ImportTrainSchedule/ImportTrainScheduleModalFooter';

/* METHOD
 *
 * 1: complete data in interactive way, proposing user to select position of each point/OP
 *   OR automatically use pathfindin/op endpoint to choose a path
 * 2: generate missing paths with new datas (or skipped part if automatically generated in phase 1)
 * 3: calculate trainSchedules and add them to the selected timetable
 * 4: two links come visible: stdcm or simulation
 *
 */

enum IMPORT_STATUS {
  READY = 'ready',
  COMPLETING_POINTS = 'completing-points',
  ALL_POINTS_COMPLETED = 'all-points-completed',
  MISSING_ROLLING_STOCK = 'missing-rolling-stock',
  PATHFINDINGS_RUNNING = 'pathfindings-running',
  PATHFINDINGS_COMPLETED = 'pathfindings-completed',
  PATHFINDINGS_FAILED = 'pathfindings-failed',
  CREATING_TRAINS = 'creating-trains',
  CREATING_TRAINS_COMPLETED = 'creating-trains-completed',
  CREATING_TRAINS_FAILED = 'creating-trains-failed',
}

const IMPORT_STATUS_ERROR = [
  IMPORT_STATUS.MISSING_ROLLING_STOCK,
  IMPORT_STATUS.PATHFINDINGS_FAILED,
  IMPORT_STATUS.CREATING_TRAINS_FAILED,
];

interface ImportTrainScheduleModalProps {
  infraId: number;
  rollingStocks: LightRollingStock[];
  timetableId: number;
  trains: TrainSchedule[];
}

const ImportTrainScheduleModal = ({
  infraId,
  rollingStocks,
  timetableId,
  trains,
}: ImportTrainScheduleModalProps) => {
  const { t } = useTranslation(['operationalStudies/importTrainSchedule']);
  const { getRollingStockID } = useOsrdConfSelectors();
  const rollingStockID = useSelector(getRollingStockID);

  const { refetch: refetchTimetable } =
    osrdEditoastApi.endpoints.getTimetableById.useQuerySubscription({ id: timetableId });
  const [postPathFinding] = osrdEditoastApi.endpoints.postPathfinding.useMutation();
  const [postTrainSchedule] =
    osrdEditoastApi.endpoints.postTrainScheduleStandaloneSimulation.useMutation();

  const [trainsWithPathRef, setTrainsWithPathRef] = useState<TrainScheduleWithPathRef[]>([]);
  const [trainsWithPath, setTrainsWithPath] = useState<TrainScheduleWithPath[]>([]);

  // Places, points, OPs to add track section id
  const [pointsDictionnary, setPointsDictionnary] = useState<Record<string, Point>>({});
  const [clickedFeatureId, setClickedFeatureId] = useState<string>();
  const [uicNumberToComplete, setUicNumberToComplete] = useState<number>();

  // Path to compute
  const [pathsDictionnary, setPathsDictionnary] = useState<
    { trainNumber: string; pathString: string }[]
  >([]);

  const [viewport, setViewport] = useState(initialViewport);
  const [status, setStatus] = useState(initialStatus);

  const [importStatus, setImportStatus] = useState<IMPORT_STATUS>(IMPORT_STATUS.READY);
  const [message, setMessage] = useState('');

  const updateImportStatus = (newStatus: IMPORT_STATUS, newMessage = '') => {
    if (newStatus !== importStatus) setImportStatus(newStatus);
    if (newMessage !== '') {
      setMessage(newMessage);
    } else {
      switch (newStatus) {
        case IMPORT_STATUS.MISSING_ROLLING_STOCK:
          setMessage(
            [t('status.noImportationPossible'), t('status.missingRollingStock')].join('\n')
          );
          break;
        case IMPORT_STATUS.ALL_POINTS_COMPLETED:
          setMessage(t('status.uicComplete'));
          break;
        case IMPORT_STATUS.PATHFINDINGS_COMPLETED:
          setMessage(t('status.pathComplete'));
          break;
        case IMPORT_STATUS.PATHFINDINGS_FAILED:
          setMessage(t('status.pathsFailed'));
          break;
        case IMPORT_STATUS.CREATING_TRAINS_FAILED:
          setMessage(t('status.calculatingTrainScheduleCompleteAllFailure'));
          break;
        default:
          setMessage('');
      }
    }
  };

  const importStatusIsError = useMemo(
    () => IMPORT_STATUS_ERROR.includes(importStatus),
    [importStatus]
  );

  function testMissingInfos() {
    if (!rollingStockID) {
      updateImportStatus(IMPORT_STATUS.MISSING_ROLLING_STOCK);
    } else {
      updateImportStatus(IMPORT_STATUS.READY);
    }
  }

  function getTrackSectionID(lat: number, lng: number) {
    setViewport({
      latitude: lat,
      longitude: lng,
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
      const pointToComplete = pointsDictionnary[uic2complete[uicNumberToCompleteLocal]];
      getTrackSectionID(pointToComplete.latitude, pointToComplete.longitude);
      updateImportStatus(
        IMPORT_STATUS.COMPLETING_POINTS,
        t('status.complete', {
          uicNumber: uicNumberToCompleteLocal,
          uicTotalCount: uic2complete.length,
          uicName: pointToComplete.name,
        })
      );
    } else {
      updateImportStatus(IMPORT_STATUS.ALL_POINTS_COMPLETED);
      setUicNumberToComplete(undefined);
      setStatus({ ...status, uicComplete: true });
    }
  }

  //
  // 2 GENERATE PATHS (autocomplete to automatically look for OPs)
  //

  function endGeneratePaths(newTrainsWithPath: TrainScheduleWithPath[]) {
    if (newTrainsWithPath.length > 0) {
      updateImportStatus(IMPORT_STATUS.PATHFINDINGS_COMPLETED);
    } else updateImportStatus(IMPORT_STATUS.PATHFINDINGS_FAILED);
    setTrainsWithPath(newTrainsWithPath);
    setStatus({ ...status, pathFindingDone: true });
  }

  /**
   * Launch pathfindings.
   *
   * For each path, launch a pathfinding request (one at the time).
   * If a pathfinding is not successful, the corresponding trainSchedules will not be imported.
   */
  async function generatePaths(autocomplete = false) {
    const pathErrors: string[] = [];
    const pathFindings: Record<string, { rollingStockId: number; pathFinding: PathResponse }> = {};
    const pathFindingsCount = pathsDictionnary.length;
    let pathFindingsDoneCount = 0;

    // eslint-disable-next-line no-restricted-syntax
    for await (const path of pathsDictionnary) {
      pathFindingsDoneCount += 1;
      const pathRef = path.trainNumber;
      const { payload, rollingStockId } = generatePathfindingPayload(
        trainsWithPathRef,
        rollingStocks,
        path.trainNumber,
        rollingStockID,
        infraId,
        autocomplete,
        pointsDictionnary
      );
      updateImportStatus(
        IMPORT_STATUS.PATHFINDINGS_RUNNING,
        t('status.searchingPath', {
          pathFindingsDoneCount,
          pathFindingsCount,
          pathRef,
        })
      );

      await postPathFinding({ pathfindingRequest: payload })
        .unwrap()
        .then((pathFinding) => {
          pathFindings[pathRef] = { rollingStockId, pathFinding };
        })
        .catch(() => {
          console.warn(`pathfinding error for path ${pathRef}`);
          pathErrors.push(pathRef);
        });
    }

    let trainsDropped = 0;
    const newTrains = compact(
      trainsWithPathRef.map((train) => {
        if (!pathFindings[train.pathRef]) {
          trainsDropped += 1;
          return null;
        }
        return {
          ...train,
          pathId: pathFindings[train.pathRef].pathFinding.id,
          rollingStockId: pathFindings[train.pathRef].rollingStockId,
          pathFinding: pathFindings[train.pathRef].pathFinding,
        };
      })
    );
    if (pathErrors.length > 0) {
      console.warn(`${pathErrors.length} chemins non trouvés, ${trainsDropped} trains abandonnés`);
    }

    endGeneratePaths(newTrains);
  }

  async function generateAutocompletePaths() {
    return generatePaths(true);
  }

  //
  // 3 CALCULATE TRAINS SCHEDULES
  //

  async function launchTrainSchedules(payload: {
    path: number;
    schedules: TrainScheduleBatchItem[];
    timetable: number;
  }) {
    try {
      await postTrainSchedule({ body: payload }).unwrap();
    } catch (error) {
      return false;
    }
    return true;
  }

  async function generateTrainSchedules() {
    const payloads = generateTrainSchedulesPayload(trainsWithPath, timetableId);
    const trainsCount = payloads.reduce((result, payload) => result + payload.schedules.length, 0);
    updateImportStatus(IMPORT_STATUS.CREATING_TRAINS, t('status.calculatingTrainSchedule'));
    const messages = [];
    let successfulTrainsCount = 0;
    // eslint-disable-next-line no-restricted-syntax
    for await (const payload of payloads) {
      const success = await launchTrainSchedules(payload);
      if (success) {
        successfulTrainsCount += payload.schedules.length;
      }
      const msg = `${t(
        success
          ? 'status.calculatingTrainScheduleComplete'
          : 'errorMessages.unableToCreateTrainSchedule',
        {
          pathId: payload.path,
          createdTrainsCount: successfulTrainsCount,
          trainsCount,
        }
      )}`;
      messages.push(msg);
      updateImportStatus(IMPORT_STATUS.CREATING_TRAINS, messages.join('\n'));
    }
    if (successfulTrainsCount > 0) {
      setStatus({ ...status, trainSchedulesDone: true, success: true });
      updateImportStatus(
        IMPORT_STATUS.CREATING_TRAINS_COMPLETED,
        t('status.calculatingTrainScheduleCompleteAll', {
          count: successfulTrainsCount,
          successfulTrainsCount,
          trainsCount,
        })
      );
      refetchTimetable();
    } else {
      setStatus({ ...status, trainSchedulesDone: true });
      updateImportStatus(IMPORT_STATUS.CREATING_TRAINS_FAILED);
    }
  }

  useEffect(() => {
    if (clickedFeatureId && uicNumberToComplete !== undefined) {
      const actualUic = Object.keys(pointsDictionnary)[uicNumberToComplete];
      setPointsDictionnary({
        ...pointsDictionnary,
        [actualUic]: {
          ...pointsDictionnary[actualUic],
          trackSectionId: clickedFeatureId,
        },
      });
      setClickedFeatureId(undefined);

      completePaths();
    }
  }, [clickedFeatureId]);

  useEffect(() => {
    if (rollingStocks && trains && trains.length > 0) {
      refactorUniquePaths(trains, setTrainsWithPathRef, setPathsDictionnary, setPointsDictionnary);
    }
  }, [trains, rollingStocks]);

  useEffect(() => {
    testMissingInfos();
  }, [infraId, rollingStockID, timetableId]);

  return (
    <>
      {pathsDictionnary && trainsWithPathRef && (
        <ModalBodySNCF>
          {!infraId || !timetableId || !rollingStockID ? null : (
            <>
              <button
                className={cx('btn', 'btn-sm', 'btn-block', 'd-flex', 'justify-content-between', {
                  'btn-primary': !status.uicComplete && !status.pathFindingDone,
                  'btn-outline-success': status.uicComplete,
                  'btn-outline-secondary': !status.uicComplete && status.pathFindingDone,
                })}
                type="button"
                onClick={() => completePaths(true)}
              >
                <span>1 — {t('completeTrackSectionID')}</span>
                <span>{Object.keys(pointsDictionnary).length}</span>
              </button>
              <button
                className={cx('btn', 'btn-sm', 'btn-block', 'd-flex', 'justify-content-between', {
                  'btn-primary': !status.pathFindingDone,
                  'btn-outline-danger':
                    status.uicComplete && importStatus === IMPORT_STATUS.PATHFINDINGS_FAILED,
                  'btn-outline-success':
                    status.uicComplete &&
                    status.pathFindingDone &&
                    importStatus !== IMPORT_STATUS.PATHFINDINGS_FAILED,
                })}
                disabled={!status.uicComplete}
                type="button"
                onClick={() => generatePaths()}
              >
                <span>2 — {t('generatePaths')}</span>
                <span>{pathsDictionnary.length}</span>
              </button>
              <div className="my-1 text-center">{t('or')}</div>
              <button
                className={cx(
                  'btn',
                  'btn-sm',
                  'btn-block',
                  'd-flex',
                  'justify-content-between',
                  'text-wrap',
                  'text-left',
                  {
                    'btn-primary': !status.pathFindingDone,
                    'btn-outline-success': status.pathFindingDone && !status.uicComplete,
                    'btn-outline-danger': status.pathFindingDone && !trainsWithPath.length,
                  }
                )}
                type="button"
                disabled={status.pathFindingDone && status.uicComplete}
                onClick={generateAutocompletePaths}
              >
                <span>1/2 — {t('generatePathsAuto')}</span>
                <span>{pathsDictionnary.length}</span>
              </button>
              <Spacer height={50} />
              <button
                className={cx('btn', 'btn-sm', 'btn-block', 'd-flex', 'justify-content-between', {
                  'btn-primary': !status.trainSchedulesDone,
                  'btn-outline-danger': importStatus === IMPORT_STATUS.CREATING_TRAINS_FAILED,
                  'btn-outline-success': importStatus === IMPORT_STATUS.CREATING_TRAINS_COMPLETED,
                })}
                disabled={!status.pathFindingDone || trainsWithPath.length === 0}
                type="button"
                onClick={generateTrainSchedules}
              >
                <span>3 — {t('generateTrainSchedules')}</span>
                <span>{trains.length}</span>
              </button>

              <hr />
            </>
          )}

          <p className={cx({ 'text-danger': importStatusIsError })}>{message}</p>

          {uicNumberToComplete !== undefined && (
            <div className="automated-map">
              <Map
                viewport={viewport}
                setViewport={setViewport}
                setClickedFeatureId={setClickedFeatureId}
              />
            </div>
          )}
        </ModalBodySNCF>
      )}
      <ImportTrainScheduleModalFooter status={status} />
    </>
  );
};

export default ImportTrainScheduleModal;
