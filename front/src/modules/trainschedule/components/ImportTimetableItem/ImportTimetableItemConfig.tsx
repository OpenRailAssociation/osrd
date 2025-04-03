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
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import StationCard from 'common/StationCard';
import UploadFileModal from 'common/uploadFileModal';
import StationSelector from 'modules/trainschedule/components/ImportTimetableItem/ImportTimetableItemStationSelector';
import { setFailure, setWarning } from 'reducers/main';
import { useAppDispatch } from 'store';
import { formatIsoDate } from 'utils/date';

import { buildSteps, cleanTimeFormat } from './helpers/buildStepsFromOcp';
import {
  handleFileReadingError,
  processJsonFile,
  processXmlFile,
} from '../ManageTrainSchedule/helpers/handleParseFiles';

interface ImportTimetableItemConfigProps {
  setTrainsList: (trainsList: ImportedTrainSchedule[]) => void;
  setIsLoading: (isLoading: boolean) => void;
  setTrainsJsonData: (trainsJsonData: TimetableJsonPayload) => void;
  setTrainsXmlData: (trainsXmlData: ImportedTrainSchedule[]) => void;
}

const ImportTimetableItemConfig = ({
  setTrainsList,
  setIsLoading,
  setTrainsJsonData,
  setTrainsXmlData,
}: ImportTimetableItemConfigProps) => {
  const { t } = useTranslation(['operationalStudies/importTimetableItem']);
  const [from, setFrom] = useState<ImportStation | undefined>();
  const [fromSearchString, setFromSearchString] = useState('');
  const [to, setTo] = useState<ImportStation | undefined>();
  const [toSearchString, setToSearchString] = useState('');
  const [date, setDate] = useState(formatIsoDate(new Date()));
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
    setTrainsXmlData([]);

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

  const mapTrainNames = (trainSchedules: ImportedTrainSchedule[], trains: Element[]) => {
    const trainPartToTrainMap: Record<string, string> = {};

    trains.forEach((train) => {
      const trainPartRef = train.getElementsByTagName('trainPartRef')[0]?.getAttribute('ref');
      const trainName = train.getAttribute('name') ?? '';
      if (trainPartRef) {
        trainPartToTrainMap[trainPartRef] = trainName;
      }
    });

    const updatedTrainSchedules = trainSchedules.map((schedule) => {
      const mappedTrainNumber = trainPartToTrainMap[schedule.trainNumber] || schedule.trainNumber;

      return {
        ...schedule,
        trainNumber: mappedTrainNumber,
      };
    });

    return updatedTrainSchedules;
  };

  const parseRailML = async (xmlDoc: Document): Promise<ImportedTrainSchedule[]> => {
    const trainSchedules: ImportedTrainSchedule[] = [];

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

    const trainParts = Array.from(xmlDoc.getElementsByTagName('trainPart'));
    const period = xmlDoc.getElementsByTagName('timetablePeriod')[0];
    const startDate = period ? period.getAttribute('startDate') : null;

    if (!startDate) {
      console.error('Start Date not found in the timetablePeriod.');
      return trainSchedules;
    }

    trainParts.forEach((train) => {
      const trainNumber = train.getAttribute('id') ?? '';
      const ocpSteps = Array.from(train.getElementsByTagName('ocpTT'));
      const formationTT = train.getElementsByTagName('formationTT')[0];
      const rollingStockViriato = formationTT?.getAttribute('formationRef');
      const firstOcpTT = ocpSteps[0];
      const firstDepartureTime = firstOcpTT
        .getElementsByTagName('times')[0]
        ?.getAttribute('departure');

      const firstDepartureTimeformatted = firstDepartureTime && cleanTimeFormat(firstDepartureTime);

      const lastOcpTT = ocpSteps[ocpSteps.length - 1];
      const lastDepartureTime =
        lastOcpTT.getElementsByTagName('times')[0]?.getAttribute('departure') ??
        lastOcpTT.getElementsByTagName('times')[0]?.getAttribute('arrival');
      const lastDepartureTimeformatted = lastDepartureTime && cleanTimeFormat(lastDepartureTime);

      // Build steps using the fully populated localCichDict
      const adaptedSteps = buildSteps(ocpSteps, localCichDict, startDate);

      const trainSchedule: ImportedTrainSchedule = {
        trainNumber,
        rollingStock: rollingStockViriato, // RollingStocks in viriato files rarely have the correct format
        departureTime: `${startDate} ${firstDepartureTimeformatted}`,
        arrivalTime: `${startDate} ${lastDepartureTimeformatted}`,
        departure: '', // Default for testing
        steps: adaptedSteps,
      };

      trainSchedules.push(trainSchedule);
    });
    const trains = Array.from(xmlDoc.getElementsByTagName('train'));
    const updatedTrainSchedules = mapTrainNames(trainSchedules, trains);
    setTrainsXmlData(updatedTrainSchedules);
    return updatedTrainSchedules;
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
      await processXmlFile(fileContent, parseRailML, updateTrainSchedules);
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
