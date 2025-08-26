import { useState, useContext } from 'react';

import { Download, Search } from '@osrd-project/ui-icons';
import { isEmpty } from 'lodash';
import { useTranslation } from 'react-i18next';

import type { TimetableJsonPayload } from 'applications/operationalStudies/types';
import {
  type GraouStation,
  type GraouTrainSchedule,
  type GraouTrainScheduleConfig,
  getGraouTrainSchedules,
} from 'common/api/graouApi';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import StationCard from 'common/StationCard';
import UploadFileModal from 'common/uploadFileModal';
import { setFailure, setWarning } from 'reducers/main';
import { useAppDispatch } from 'store';
import { formatLocalDate } from 'utils/date';
import { castErrorToFailure } from 'utils/error';

import parseXML from './helpers/parseXML';
import StationSelector from './ImportTimetableItemStationSelector';
import {
  handleFileReadingError,
  processJsonFile,
} from '../ManageTimetableItem/helpers/handleParseFiles';

type ImportTimetableItemConfigProps = {
  setTrainsList: (trainsList: GraouTrainSchedule[]) => void;
  setIsLoading: (isLoading: boolean) => void;
  setTrainsJsonData: (trainsJsonData: TimetableJsonPayload) => void;
};

const ImportTimetableItemConfig = ({
  setTrainsList,
  setIsLoading,
  setTrainsJsonData,
}: ImportTimetableItemConfigProps) => {
  const { t } = useTranslation('operational-studies', { keyPrefix: 'importTrains' });
  const [from, setFrom] = useState<GraouStation | undefined>();
  const [fromSearchString, setFromSearchString] = useState('');
  const [to, setTo] = useState<GraouStation | undefined>();
  const [toSearchString, setToSearchString] = useState('');
  const [date, setDate] = useState(formatLocalDate(new Date()));
  const [startTime, setStartTime] = useState('00:00');
  const [endTime, setEndTime] = useState('23:59');
  const dispatch = useAppDispatch();
  const { openModal, closeModal } = useContext(ModalContext);

  function filterInvalidSteps(importedTrainSchedules: GraouTrainSchedule[]): GraouTrainSchedule[] {
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

  function updateTrainSchedules(importedTrainSchedules: GraouTrainSchedule[]) {
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

  async function getTrainsFromOpenData(config: GraouTrainScheduleConfig) {
    setTrainsList([]);
    setIsLoading(true);
    setTrainsJsonData({ train_schedules: [], paced_trains: [] });

    let result;
    try {
      result = await getGraouTrainSchedules(config);
    } catch (error) {
      dispatch(setFailure(castErrorToFailure(error)));
      setIsLoading(false);
      return;
    }

    const importedTrainSchedules = filterInvalidSteps(result);
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

  const processXmlFile = async (fileContent: string) => {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(fileContent, 'application/xml');
    const parserError = xmlDoc.getElementsByTagName('parsererror');

    if (parserError.length > 0) {
      throw new Error('Invalid XML');
    }

    const trainData = await parseXML(xmlDoc);
    setTrainsJsonData(trainData);
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
