import { useContext, useMemo, useState } from 'react';

import { Download } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { useScenarioContext } from 'applications/operationalStudies/hooks/useScenarioContext';
import type { TimetableJsonPayload } from 'applications/operationalStudies/types';
import type { PacedTrain, TrainSchedule } from 'common/api/osrdEditoastApi';
import { osrdRailwayManagerApi } from 'common/api/osrdRailwayManagerApi';
import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import { Loader } from 'common/Loaders';
import { useRollingStockContext } from 'common/RollingStockContext';
import { useSubCategoryContext } from 'common/SubCategoryContext';
import UploadFileModal from 'common/uploadFileModal';
import { setFailure } from 'reducers/main';
import { getRailwayManagerInterfaceUrl } from 'reducers/main/mainSelector';
import type { TimetableItem } from 'reducers/osrdconf/types';
import { useAppDispatch } from 'store';
import { castErrorToFailure } from 'utils/error';

import { generateTrainPayloads } from './helpers/generatePayloads';
import { processJsonFile } from './helpers/parseJson';
import locallyProcessXmlFile from './helpers/parseXML';
import { postFullImportPayload } from './helpers/postPayloads';

type ImportTimetableItemProps = {
  upsertTimetableItems: (timetableItems: TimetableItem[]) => void;
};

const ImportTimetableItem = ({ upsertTimetableItems }: ImportTimetableItemProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [trainsJsonData, setTrainsJsonData] = useState<TimetableJsonPayload>({
    train_schedules: [],
    paced_trains: [],
  });

  const { rollingStocks } = useRollingStockContext();

  const { t } = useTranslation('operational-studies', { keyPrefix: 'importTrains' });
  const dispatch = useAppDispatch();
  const { scenario } = useScenarioContext();
  const {
    train_schedules: parsedTrainSchedules,
    paced_trains: parsedPacedTrains,
    macro_nodes: macroNodes,
    macro_notes: macroNotes,
    round_trips: roundTripsFromJsonData,
  } = trainsJsonData;

  const subCategories = useSubCategoryContext();
  const railwayManagerUrl = useSelector(getRailwayManagerInterfaceUrl);
  const { openModal, closeModal } = useContext(ModalContext);
  const [postTransformTimetable] =
    osrdRailwayManagerApi.endpoints.postTransformTimetable.useMutation();

  const { pacedTrainsPayload, trainSchedulesPayload } = useMemo<{
    pacedTrainsPayload: PacedTrain[];
    trainSchedulesPayload: TrainSchedule[];
  }>(
    () => generateTrainPayloads(parsedPacedTrains, parsedTrainSchedules, subCategories),
    [parsedPacedTrains, parsedTrainSchedules, subCategories]
  );

  const timetableId = scenario.timetable_id;

  const processXmlFile = async (file: File, fileContent: string): Promise<TimetableJsonPayload> => {
    if (!railwayManagerUrl) {
      return await locallyProcessXmlFile(fileContent);
    }
    try {
      return (await postTransformTimetable({ body: file }).unwrap()) as TimetableJsonPayload;
    } catch (error: unknown) {
      //TODO: check whether the code should be: if (isObject(error) && 'status' in error && error.status === '415') return await locallyProcessXmlFile(fileContent); else throw error
      dispatch(setFailure(castErrorToFailure(error)));
      return await locallyProcessXmlFile(fileContent);
    }
  };

  const importFile = async (file: File) => {
    try {
      closeModal();
      setIsLoading(true);
      const fileContent = await file.text();

      const jsonPayload = processJsonFile(fileContent, file.type, t);
      if (jsonPayload !== null) {
        setTrainsJsonData(jsonPayload);
      } else {
        setTrainsJsonData(await processXmlFile(file, fileContent));
      }
    } catch (error: unknown) {
      dispatch(setFailure(castErrorToFailure(error)));
    } finally {
      setIsLoading(false);
    }
  };

  return !isLoading && rollingStocks ? (
    <main className="import-timetable-item" data-testid="import-timetable-item">
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
      <button
        data-testid="launch-import-button"
        className="btn btn-primary btn-sm ml-auto"
        type="button"
        onClick={() =>
          postFullImportPayload(
            timetableId,
            scenario.id,
            [...trainSchedulesPayload, ...pacedTrainsPayload],
            roundTripsFromJsonData,
            macroNodes,
            macroNotes,
            dispatch,
            t,
            upsertTimetableItems
          )
        }
      />
    </main>
  ) : (
    <Loader />
  );
};

export default ImportTimetableItem;
