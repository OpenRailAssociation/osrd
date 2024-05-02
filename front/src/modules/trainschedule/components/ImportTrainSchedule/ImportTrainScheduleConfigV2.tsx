import React, { useState, useContext } from 'react';

import { Download, Search } from '@osrd-project/ui-icons';
import { isEmpty } from 'lodash';
import { useTranslation } from 'react-i18next';

import type {
  ImportedTrainSchedule,
  TrainScheduleV2,
  TrainScheduleImportConfig,
} from 'applications/operationalStudies/types';
import { getGraouTrainSchedules } from 'common/api/graouApi';
import type { TrainScheduleBase } from 'common/api/osrdEditoastApi';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import StationCard, { type ImportStation } from 'common/StationCard';
import UploadFileModal from 'common/uploadFileModal';
import StationSelector from 'modules/trainschedule/components/ImportTrainSchedule/ImportTrainScheduleStationSelector';
import { setFailure } from 'reducers/main';
import { useAppDispatch } from 'store';
import { formatIsoDate } from 'utils/date';

interface ImportTrainScheduleConfigProps {
  setTrainsList: (trainsList: TrainScheduleV2[]) => void;
  setIsLoading: (isLoading: boolean) => void;
  setTrainsJsonData: (trainsJsonData: TrainScheduleBase[]) => void;
}

const ImportTrainScheduleConfigV2 = ({
  setTrainsList,
  setIsLoading,
  setTrainsJsonData,
}: ImportTrainScheduleConfigProps) => {
  const { t } = useTranslation(['operationalStudies/importTrainSchedule']);
  const [from, setFrom] = useState<ImportStation | undefined>();
  const [fromSearchString, setFromSearchString] = useState('');
  const [to, setTo] = useState<ImportStation | undefined>();
  const [toSearchString, setToSearchString] = useState('');
  const [date, setDate] = useState(formatIsoDate(new Date()));
  const [startTime, setStartTime] = useState('00:00');
  const [endTime, setEndTime] = useState('23:59');
  const dispatch = useAppDispatch();
  const { openModal, closeModal } = useContext(ModalContext);

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
    return importedTrainSchedules as ImportedTrainSchedule[];
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
    setTrainsJsonData([]);

    const result = await getGraouTrainSchedules(config);
    const importedTrainSchedules = validateImportedTrainSchedules(result);
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
      } as TrainScheduleImportConfig);
    }
  }

  const importFile = async (file: File) => {
    closeModal();
    setTrainsList([]);

    const text = await file.text();
    const importedTrainSchedules: TrainScheduleBase[] = JSON.parse(text);

    if (!isEmpty(importedTrainSchedules)) {
      setTrainsJsonData(importedTrainSchedules);
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

export default ImportTrainScheduleConfigV2;
