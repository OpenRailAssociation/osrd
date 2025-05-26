import { useState, useContext } from 'react';

import { Download, Search } from '@osrd-project/ui-icons';
import { isEmpty } from 'lodash';
import { useTranslation } from 'react-i18next';

import type {
  ImportStation,
  ImportedTrainSchedule,
  TrainScheduleImportConfig,
  CichDictValue,
  TimetableJsonPayload,
} from 'applications/operationalStudies/types';
import { getGraouTrainSchedules } from 'common/api/graouApi';
import type { PacedTrain, TrainSchedule } from 'common/api/osrdEditoastApi';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import StationCard from 'common/StationCard';
import UploadFileModal from 'common/uploadFileModal';
import StationSelector from 'modules/trainschedule/components/ImportTimetableItem/ImportTimetableItemStationSelector';
import { setFailure, setWarning } from 'reducers/main';
import { useAppDispatch } from 'store';
import { formatLocalDate } from 'utils/date';
import { Duration } from 'utils/duration';

import { buildSteps, cleanTimeFormat } from './helpers/buildStepsFromOcp';
import findMostFrequentScheduleInPacedTrain from './helpers/findMostFrequentXmlSchedule';
import {
  handleFileReadingError,
  processJsonFile,
} from '../ManageTrainSchedule/helpers/handleParseFiles';

interface ImportTimetableItemConfigProps {
  setTrainsList: (trainsList: ImportedTrainSchedule[]) => void;
  setIsLoading: (isLoading: boolean) => void;
  setTrainsJsonData: (trainsJsonData: TimetableJsonPayload) => void;
}

const ImportTimetableItemConfig = ({
  setTrainsList,
  setIsLoading,
  setTrainsJsonData,
}: ImportTimetableItemConfigProps) => {
  const { t } = useTranslation('operational-studies', { keyPrefix: 'importTrains' });
  const [from, setFrom] = useState<ImportStation | undefined>();
  const [fromSearchString, setFromSearchString] = useState('');
  const [to, setTo] = useState<ImportStation | undefined>();
  const [toSearchString, setToSearchString] = useState('');
  const [date, setDate] = useState(formatLocalDate(new Date()));
  const [startTime, setStartTime] = useState('00:00');
  const [endTime, setEndTime] = useState('23:59');
  const dispatch = useAppDispatch();
  const { openModal, closeModal } = useContext(ModalContext);

  function filterInvalidSteps(
    importedTrainSchedules: ImportedTrainSchedule[]
  ): ImportedTrainSchedule[] {
    const trainNumbersOfModifiedTrains: string[] = [];

    const filteredSchedules = importedTrainSchedules.map((trainSchedule) => {
      const filteredSteps = trainSchedule.steps.filter(
        (step, i) =>
          i === 0 ||
          new Date(step.arrivalTime).getTime() >=
            new Date(trainSchedule.steps[i - 1].departureTime).getTime()
      );
      if (filteredSteps.length < trainSchedule.steps.length) {
        trainNumbersOfModifiedTrains.push(trainSchedule.trainNumber);
      }
      return { ...trainSchedule, steps: filteredSteps };
    });

    if (trainNumbersOfModifiedTrains.length)
      dispatch(
        setWarning({
          title: t('warningMessages.warning'),
          text: t('warningMessages.warningFilteredStepImport', {
            trainNumbers: trainNumbersOfModifiedTrains,
          }),
        })
      );

    return filteredSchedules;
  }

  function validateImportedTrainSchedules(
    importedTrainSchedules: Record<string, unknown>[]
  ): ImportedTrainSchedule[] | null {
    const isInvalidTrainSchedules = importedTrainSchedules.some((trainSchedule) => {
      if (
        ['trainNumber', 'rollingStock', 'departureTime', 'arrivalTime', 'departure', 'steps'].some(
          (key) => !(key in trainSchedule)
        ) ||
        !Array.isArray(trainSchedule.steps)
      ) {
        return true;
      }
      const hasInvalidSteps = trainSchedule.steps.some((step) =>
        ['arrivalTime', 'departureTime', 'uic', 'name', 'trigram', 'latitude', 'longitude'].some(
          (key) => !(key in step)
        )
      );
      return hasInvalidSteps;
    });
    if (isInvalidTrainSchedules) {
      dispatch(
        setFailure({
          name: t('errorMessages.error'),
          message: t('errorMessages.errorImport'),
        })
      );
      return null;
    }
    return filterInvalidSteps(importedTrainSchedules as ImportedTrainSchedule[]);
  }

  function updateTrainSchedules(importedTrainSchedules: ImportedTrainSchedule[]) {
    // For each train schedule, we add the duration and tracks of each step
    const trainsSchedules = importedTrainSchedules.map((trainSchedule) => {
      const stepsWithDuration = trainSchedule.steps.map((step) => {
        // calcul duration in seconds between step arrival and departure
        // in case of arrival and departure are the same, we set duration to 0
        // for the step arrivalTime is before departureTime because the train first goes to the station and then leaves it
        const duration = Math.round(
          (new Date(step.departureTime).getTime() - new Date(step.arrivalTime).getTime()) / 1000
        );
        return {
          ...step,
          duration,
        };
      });
      return {
        ...trainSchedule,
        steps: stepsWithDuration,
      };
    });

    setTrainsList(trainsSchedules);
  }

  async function getTrainsFromOpenData(config: TrainScheduleImportConfig) {
    setTrainsList([]);
    setIsLoading(true);
    setTrainsJsonData({ train_schedules: [], paced_trains: [] });

    const result = await getGraouTrainSchedules(config);
    const importedTrainSchedules = validateImportedTrainSchedules(result!);
    if (importedTrainSchedules && !isEmpty(importedTrainSchedules)) {
      updateTrainSchedules(importedTrainSchedules);
    }

    setIsLoading(false);
  }

  function defineConfig() {
    let error = false;
    if (!from) {
      dispatch(
        setFailure({ name: t('errorMessages.error'), message: t('errorMessages.errorNoFrom') })
      );
    }
    if (!to) {
      dispatch(
        setFailure({ name: t('errorMessages.error'), message: t('errorMessages.errorNoTo') })
      );
    }
    if (!date) {
      dispatch(
        setFailure({ name: t('errorMessages.error'), message: t('errorMessages.errorNoDate') })
      );
    }
    if (JSON.stringify(from) === JSON.stringify(to)) {
      dispatch(
        setFailure({ name: t('errorMessages.error'), message: t('errorMessages.errorSameFromTo') })
      );
      error = true;
    }

    if (from && to && date && !error) {
      getTrainsFromOpenData({
        from,
        to,
        date,
        startTime,
        endTime,
      });
    }
  }
  const extractCiChCode = (code: string) => {
    const [ciCode, chCode] = code.split('/');
    return { ciCode: Number(ciCode), chCode };
  };

  const mapTrainNames = (trainSchedules: TrainSchedule[], trains: Element[]): TrainSchedule[] => {
    const trainPartToTrainMap: Record<string, string> = {};

    trains.forEach((train) => {
      const trainPartRef = train.getElementsByTagName('trainPartRef')[0]?.getAttribute('ref');
      const trainName = train.getAttribute('name') || '';
      if (trainPartRef) {
        trainPartToTrainMap[trainPartRef] = trainName;
      }
    });

    const updatedTrainSchedules = trainSchedules.map((schedule) => {
      const mappedTrainNumber = trainPartToTrainMap[schedule.train_name] || schedule.train_name;

      return {
        ...schedule,
        train_name: mappedTrainNumber,
      };
    });

    return updatedTrainSchedules;
  };

  const parseXML = async (xmlDoc: Document): Promise<TrainSchedule[]> => {
    const trainSchedules: TrainSchedule[] = [];

    // Initialize localCichDict
    const localCichDict: Record<string, CichDictValue> = {};

    const infrastructures = Array.from(xmlDoc.getElementsByTagName('infrastructure'));

    infrastructures.forEach((infrastructure) => {
      const ocps = Array.from(infrastructure.getElementsByTagName('ocp'));

      ocps.forEach((ocp) => {
        const id = ocp.getAttribute('id');
        const code = ocp.getAttribute('code');

        if (id && code) {
          const { ciCode, chCode } = extractCiChCode(code);
          localCichDict[id] = { ciCode, chCode };
        }
      });
    });

    const pacedTrains: Record<string, TrainSchedule[]> = {};
    const trainGroups = Array.from(xmlDoc.getElementsByTagName('trainGroup'));

    const trainSchedulesByTrainPartId: Record<string, TrainSchedule> = {};
    const trainParts = Array.from(xmlDoc.getElementsByTagName('trainPart'));
    const period = xmlDoc.getElementsByTagName('timetablePeriod')[0];
    const startDate = period ? period.getAttribute('startDate') : null;

    if (!startDate) {
      console.error('Start Date not found in the timetablePeriod.');
      return trainSchedules;
    }

    trainParts.forEach((train) => {
      const trainNumber = train.getAttribute('id') || '';
      const trainPartId = train.getAttribute('id') || '';
      const ocpSteps = Array.from(train.getElementsByTagName('ocpTT'));
      const formationTT = train.getElementsByTagName('formationTT')[0];
      const rollingStockXml = formationTT?.getAttribute('formationRef');
      const firstOcpTT = ocpSteps[0];
      const firstDepartureTime = firstOcpTT
        .getElementsByTagName('times')[0]
        ?.getAttribute('departure');

      const firstDepartureTimeformatted = firstDepartureTime && cleanTimeFormat(firstDepartureTime);

      // Build steps using the fully populated localCichDict
      const { path, schedule } = buildSteps(ocpSteps, localCichDict, new Date(startDate));

      const trainSchedule: TrainSchedule = {
        train_name: trainNumber,
        rolling_stock_name: rollingStockXml || '', // RollingStocks in xml files rarely have the correct format
        start_time: new Date(`${startDate} ${firstDepartureTimeformatted}`).toISOString(),
        constraint_distribution: 'MARECO',
        path,
        schedule,
      };
      trainSchedulesByTrainPartId[trainPartId] = trainSchedule;
      trainSchedules.push(trainSchedule);
    });

    const trainElementsById: Record<string, Element> = {};
    Array.from(xmlDoc.getElementsByTagName('train')).forEach((train) => {
      const id = train.getAttribute('id');
      if (id) {
        trainElementsById[id] = train;
      }
    });

    trainGroups.forEach((trainGroup) => {
      const pacedTrainId = trainGroup.getAttribute('id')!;

      const trainRefs = Array.from(trainGroup.getElementsByTagName('trainRef'));
      pacedTrains[pacedTrainId] = trainRefs
        .map((trainRef) => {
          const trainId = trainRef.getAttribute('ref');
          const trainElement = trainId ? trainElementsById[trainId] : undefined;

          const trainPartRef = trainElement?.querySelector('trainPartRef')?.getAttribute('ref');

          return trainPartRef ? trainSchedulesByTrainPartId[trainPartRef] : undefined;
        })
        .filter((schedule) => schedule !== undefined);
    });

    const pacedTrainMostFrequentSchedules: Record<
      string,
      { schedule: TrainSchedule | null; count: number }
    > = {};

    Object.entries(pacedTrains).forEach(([pacedTrainId, schedules]) => {
      const { mostFrequent, highestCount } = findMostFrequentScheduleInPacedTrain(schedules);
      pacedTrainMostFrequentSchedules[pacedTrainId] = {
        schedule: mostFrequent,
        count: highestCount,
      };
    });

    const getMostFrequentInterval = (schedules: TrainSchedule[]): Duration => {
      const departureTimes = schedules
        .map((s) => new Date(s.start_time))
        .sort((a, b) => a.getTime() - b.getTime());

      const intervalsCount = new Map<number, number>();

      for (let i = 1; i < departureTimes.length; i += 1) {
        const interval = Duration.subtractDate(departureTimes[i], departureTimes[i - 1]);
        const rawMin = interval.total('minute');

        let roundedMin: number;
        if (rawMin > 5) {
          roundedMin = Math.round(rawMin / 10) * 10;
        } else if (rawMin >= 1) {
          roundedMin = Math.round(rawMin);
        } else {
          roundedMin = 1;
        }

        intervalsCount.set(roundedMin, (intervalsCount.get(roundedMin) || 0) + 1);
      }

      let mostFrequentRoundedMin = 0;
      let maxCount = 0;

      for (const [minutes, count] of intervalsCount.entries()) {
        if (count > maxCount) {
          mostFrequentRoundedMin = minutes;
          maxCount = count;
        } else if (count === maxCount && minutes < mostFrequentRoundedMin) {
          // we take smaller interval in case of tie
          mostFrequentRoundedMin = minutes;
        }
      }

      return new Duration({ minutes: mostFrequentRoundedMin });
    };

    const buildPacedTrain = (
      pacedTrainId: string,
      pacedTrainSchedules: TrainSchedule[]
    ): PacedTrain | null => {
      if (pacedTrainSchedules.length < 2) {
        console.warn('Not enough schedules to build a paced train');
        return null;
      }

      const sortedSchedules = pacedTrainSchedules.sort(
        (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
      );

      const departureDates = sortedSchedules.map((s) => new Date(s.start_time));
      const intervalDuration = getMostFrequentInterval(pacedTrainSchedules);

      const totalDuration = Duration.subtractDate(
        departureDates[departureDates.length - 1],
        departureDates[0]
      ).add(intervalDuration);

      return {
        ...sortedSchedules[0],
        train_name: pacedTrainId,
        paced: {
          interval: intervalDuration.toISOString(),
          time_window: totalDuration.toISOString(),
        },
        exceptions: [],
      };
    };

    const importedPacedTrains: PacedTrain[] = Object.entries(pacedTrains)
      .map(([pacedTrainId, pacedTrainSchedules]) =>
        buildPacedTrain(pacedTrainId, pacedTrainSchedules)
      )
      .filter((pacedTrain) => pacedTrain !== null);

    const trains = Array.from(xmlDoc.getElementsByTagName('train'));
    const updatedTrainSchedules = mapTrainNames(trainSchedules, trains);
    const trainSchedulesInPacedTrain = new Set(
      Object.values(pacedTrains)
        .flat()
        .map((schedule) => schedule.train_name)
    );

    const singleTrainSchedules = trainSchedules.filter(
      (schedule) => !trainSchedulesInPacedTrain.has(schedule.train_name)
    );

    setTrainsJsonData({ train_schedules: singleTrainSchedules, paced_trains: importedPacedTrains });

    return updatedTrainSchedules;
  };

  const processXmlFile = async (fileContent: string) => {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(fileContent, 'application/xml');
    const parserError = xmlDoc.getElementsByTagName('parsererror');

    if (parserError.length > 0) {
      throw new Error('Invalid XML');
    }

    await parseXML(xmlDoc);
  };

  const importFile = async (file: File) => {
    closeModal();
    setTrainsList([]);

    let fileContent: string;
    try {
      fileContent = await file.text();
    } catch (error) {
      handleFileReadingError(error as Error);
      return;
    }

    const fileHasBeenParsed = processJsonFile(
      fileContent,
      file.type,
      setTrainsJsonData,
      dispatch,
      t
    );

    // the file has been processed, return
    if (fileHasBeenParsed) {
      return;
    }

    // try to parse the file as an XML file
    try {
      await processXmlFile(fileContent);
    } catch {
      // the file is not supported or is an invalid XML file
      dispatch(
        setFailure({
          name: t('errorMessages.error'),
          message: t('errorMessages.errorInvalidFile'),
        })
      );
    }
  };
  return (
    <>
      <div className="container-fluid row no-gutters mb-2">
        <div className="col-lg-6 station-selector sm-gutters">
          <div className="mb-2">
            <div className="osrd-config-item-container osrd-config-item-from">
              <h2>{t('from')}</h2>
              {from ? (
                <div
                  className="result-station-selected"
                  aria-label={t('from')}
                  onClick={() => setFrom(undefined)}
                  role="button"
                  tabIndex={0}
                >
                  <StationCard station={from} fixedHeight />
                </div>
              ) : (
                <StationSelector
                  id="fromSearch"
                  onSelect={setFrom}
                  term={fromSearchString}
                  setTerm={setFromSearchString}
                />
              )}
            </div>
          </div>
        </div>
        <div className="col-lg-6 station-selector sm-gutters">
          <div className="mb-2">
            <div className="osrd-config-item-container osrd-config-item-to">
              <h2>{t('to')}</h2>
              {to ? (
                <div
                  className="result-station-selected"
                  aria-label={t('to')}
                  onClick={() => setTo(undefined)}
                  role="button"
                  tabIndex={0}
                >
                  <StationCard station={to} fixedHeight />
                </div>
              ) : (
                <StationSelector
                  id="toSearch"
                  onSelect={setTo}
                  term={toSearchString}
                  setTerm={setToSearchString}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="container-fluid mb-2">
        <div className="row no-gutters">
          <div className="col-lg-10 col-10">
            <div className="osrd-config-item-container osrd-config-item-datetime">
              <h2>{t('datetime')}</h2>
              <div className="mb-2">
                <InputSNCF
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDate(e.target.value)}
                  sm
                  noMargin
                  step={0}
                  unit={t('date')}
                />
              </div>
              <div className="row no-gutters">
                <div className="col-6 sm-gutters">
                  <InputSNCF
                    id="startTime"
                    type="time"
                    value={startTime}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setStartTime(e.target.value)
                    }
                    sm
                    noMargin
                    step={0}
                    unit={t('startTime')}
                  />
                </div>
                <div className="col-6 sm-gutters">
                  <InputSNCF
                    id="endTime"
                    type="time"
                    value={endTime}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setEndTime(e.target.value)
                    }
                    sm
                    noMargin
                    step={0}
                    unit={t('endTime')}
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="col-lg-2 col-2 d-flex flex-column no-gutters pl-1">
            <button
              type="button"
              className="btn btn-sm btn-primary btn-block h-100"
              aria-label={t('searchTimetable')}
              title={t('searchTimetable')}
              onClick={defineConfig}
            >
              <Search />
            </button>
            <button
              type="button"
              className="btn btn-sm btn-secondary btn-block h-100"
              aria-label={t('importTimetable')}
              title={t('importTimetable')}
              onClick={() => openModal(<UploadFileModal handleSubmit={importFile} />)}
            >
              <Download />
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default ImportTimetableItemConfig;
