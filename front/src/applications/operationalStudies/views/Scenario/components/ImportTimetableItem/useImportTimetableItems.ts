import { isObject } from 'lodash';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { useScenarioContext } from 'applications/operationalStudies/hooks/useScenarioContext';
import type { TimetableJsonPayload } from 'applications/operationalStudies/types';
import { osrdRailwayManagerApi } from 'common/api/osrdRailwayManagerApi';
import { useSubCategoryContext } from 'common/SubCategoryContext';
import { setFailure } from 'reducers/main';
import { getRailwayManagerInterfaceUrl } from 'reducers/main/mainSelector';
import type { TimetableItem } from 'reducers/osrdconf/types';
import { useAppDispatch } from 'store';
import { castErrorToFailure } from 'utils/error';

import { generateTrainPayloads } from './helpers/generatePayloads';
import { processJsonFile } from './helpers/parseJson';
import locallyProcessXmlFile from './helpers/parseXML';
import { postFullImportPayload } from './helpers/postPayloads';

type ImportTimetableItemsProps = {
  upsertTimetableItems: (timetableItems: TimetableItem[]) => void;
};

const useImportTimetableItems = ({ upsertTimetableItems }: ImportTimetableItemsProps) => {
  const { t } = useTranslation('operational-studies', { keyPrefix: 'importTrains' });
  const dispatch = useAppDispatch();
  const { scenario, sandboxId } = useScenarioContext();

  const subCategories = useSubCategoryContext();
  const railwayManagerUrl = useSelector(getRailwayManagerInterfaceUrl);
  const [postTransformTimetable] =
    osrdRailwayManagerApi.endpoints.postTransformTimetable.useMutation();

  /**
   * Parse an xml file using the provided railway manager interface.
   * If the interface is unset or the interface responds with 415 unsupported media type, fallback to local xml parsing.
   */
  const processXmlFile = async (file: File, fileContent: string): Promise<TimetableJsonPayload> => {
    if (!railwayManagerUrl) {
      return await locallyProcessXmlFile(fileContent);
    }
    try {
      return (await postTransformTimetable({ body: file }).unwrap()) as TimetableJsonPayload;
    } catch (error: unknown) {
      if (isObject(error) && 'status' in error && error.status === '415')
        return await locallyProcessXmlFile(fileContent);
      throw error;
    }
  };

  const processFile = async (file: File): Promise<TimetableJsonPayload> => {
    const fileContent = await file.text();
    const jsonPayload = processJsonFile(fileContent, file.type, t);
    if (jsonPayload !== null) return jsonPayload;
    return await processXmlFile(file, fileContent);
  };

  const importFile = async (file: File) => {
    try {
      const {
        train_schedules: parsedTrainSchedules,
        paced_trains: parsedPacedTrains,
        macro_nodes: macroNodes,
        macro_notes: macroNotes,
        round_trips: roundTripsFromJsonData,
      } = await processFile(file);

      const { pacedTrainsPayload, trainSchedulesPayload } = generateTrainPayloads(
        parsedPacedTrains,
        parsedTrainSchedules,
        subCategories
      );

      await postFullImportPayload(
        sandboxId,
        scenario.id,
        [...trainSchedulesPayload, ...pacedTrainsPayload],
        roundTripsFromJsonData,
        macroNodes,
        macroNotes,
        dispatch,
        t,
        upsertTimetableItems
      );
    } catch (error: unknown) {
      dispatch(setFailure(castErrorToFailure(error)));
    }
  };

  return importFile;
};

export default useImportTimetableItems;
