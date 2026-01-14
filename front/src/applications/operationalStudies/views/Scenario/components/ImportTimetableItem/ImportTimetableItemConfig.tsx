import { useState, useContext } from 'react';

import { Download, Search } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { useScenarioContext } from 'applications/operationalStudies/hooks/useScenarioContext';
import type { TimetableJsonPayload } from 'applications/operationalStudies/types';
import {
  type GraouStation,
  type GraouTrainScheduleConfig,
  getGraouTrainSchedules,
} from 'common/api/graouApi';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { osrdRailwayManagerApi } from 'common/api/osrdRailwayManagerApi';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import StationCard from 'common/StationCard';
import UploadFileModal from 'common/uploadFileModal';
import { setFailure, setWarning } from 'reducers/main';
import { getRailwayManagerInterfaceUrl } from 'reducers/main/mainSelector';
import { useAppDispatch } from 'store';
import { formatLocalDate } from 'utils/date';
import { castErrorToFailure } from 'utils/error';

import {
  generateTrainSchedulesPayloads,
  populateMissingSecondaryCodes,
} from './helpers/parseGraouTrains';
import parseXML from './helpers/parseXML';
import StationSelector from './ImportTimetableItemStationSelector';
import {
  handleFileReadingError,
  processJsonFile,
} from '../ManageTimetableItem/helpers/handleParseFiles';

type ImportTimetableItemConfigProps = {
  setIsLoading: (isLoading: boolean) => void;
  setTrainsJsonData: (trainsJsonData: TimetableJsonPayload) => void;
};

const ImportTimetableItemConfig = ({
  setIsLoading,
  setTrainsJsonData,
}: ImportTimetableItemConfigProps) => {
  const { t } = useTranslation('operational-studies', { keyPrefix: 'importTrains' });
  const railwayManagerUrl = useSelector(getRailwayManagerInterfaceUrl);
  const { infraId } = useScenarioContext();
  const [from, setFrom] = useState<GraouStation | undefined>();
  const [fromSearchString, setFromSearchString] = useState('');
  const [to, setTo] = useState<GraouStation | undefined>();
  const [toSearchString, setToSearchString] = useState('');
  const [date, setDate] = useState(formatLocalDate(new Date()));
  const [startTime, setStartTime] = useState('00:00');
  const [endTime, setEndTime] = useState('23:59');
  const dispatch = useAppDispatch();
  const { openModal, closeModal } = useContext(ModalContext);
  const [postTransformTimetable] =
    osrdRailwayManagerApi.endpoints.postTransformTimetable.useMutation();
  const [postInfraByInfraIdMatchOperationalPoints] =
    osrdEditoastApi.endpoints.postInfraByInfraIdMatchOperationalPoints.useLazyQuery();

  async function getTrainsFromOpenData(config: GraouTrainScheduleConfig) {
    try {
      setIsLoading(true);
      setTrainsJsonData({ train_schedules: [], paced_trains: [] });

      const {
        trainSchedules: graouTrains,
        rejectedTrainsCount,
        modifiedTrainsNames,
      } = await getGraouTrainSchedules(config);
      if (rejectedTrainsCount)
        dispatch(
          setWarning({
            title: t('warningMessages.warning'),
            text: t('warningMessages.warningRejectedTrainsImport', {
              rejectedTrainsCount,
            }),
          })
        );
      if (modifiedTrainsNames.length)
        dispatch(
          setWarning({
            title: t('warningMessages.warning'),
            text: t('warningMessages.warningFilteredStepImport', {
              modifiedTrainsNames,
            }),
          })
        );

      const trainSchedulesPayloads = generateTrainSchedulesPayloads(graouTrains);
      await populateMissingSecondaryCodes(
        trainSchedulesPayloads,
        infraId,
        postInfraByInfraIdMatchOperationalPoints
      );
      setTrainsJsonData({ train_schedules: trainSchedulesPayloads, paced_trains: [] });
    } catch (error) {
      dispatch(setFailure(castErrorToFailure(error)));
    } finally {
      setIsLoading(false);
    }
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

  const locallyProcessXmlFile = async (fileContent: string) => {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(fileContent, 'application/xml');
      const parserError = xmlDoc.getElementsByTagName('parsererror');

      if (parserError.length > 0) {
        throw new Error('Invalid XML');
      }

      const trainData = await parseXML(xmlDoc);
      setTrainsJsonData(trainData);
    } catch (error: unknown) {
      const failure = castErrorToFailure(error);
      dispatch(setFailure(failure));
    }
  };

  const processXmlFile = async (file: File, fileContent: string) => {
    setIsLoading(true);

    if (!railwayManagerUrl) {
      await locallyProcessXmlFile(fileContent);
      setIsLoading(false);
      return;
    }
    try {
      const trainData = await postTransformTimetable({ body: file }).unwrap();
      setTrainsJsonData(trainData as TimetableJsonPayload);
    } catch (error: unknown) {
      await locallyProcessXmlFile(fileContent);
      const failure = castErrorToFailure(error);
      dispatch(setFailure(failure));
    } finally {
      setIsLoading(false);
    }
  };

  const importFile = async (file: File) => {
    closeModal();

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
    await processXmlFile(file, fileContent);
  };
  return (
    <div className="container-fluid mb-2">
      <div className="row no-gutters">
        <div className="col-12 d-flex flex-column no-gutters pl-1">
          <button
            type="button"
            className="btn btn-sm btn-secondary btn-block import-button"
            aria-label={t('importTimetable')}
            title={t('importTimetable')}
            onClick={() => openModal(<UploadFileModal handleSubmit={importFile} />)}
            data-testid="import-timetable-item-upload-button"
          >
            <Download />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportTimetableItemConfig;
