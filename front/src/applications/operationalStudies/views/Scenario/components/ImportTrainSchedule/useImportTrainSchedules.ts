import { isObject } from 'lodash';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { useScenarioContext } from 'applications/operationalStudies/hooks/useScenarioContext';
import { useTimetableContext } from 'applications/operationalStudies/hooks/useTimetableContext';
import type { TimetableJsonPayload } from 'applications/operationalStudies/types';
import { osrdRailwayManagerApi } from 'common/api/osrdRailwayManagerApi';
import { useSubCategoryContext } from 'common/SubCategoryContext';
import { setFailure, setSuccess } from 'reducers/main';
import { getRailwayManagerInterfaceUrl } from 'reducers/main/mainSelector';
import { useAppDispatch } from 'store';
import { castErrorToFailure } from 'utils/error';

import { adaptPayloadForTargetTimetable } from './helpers/adaptJsonImport';
import { processJsonFile } from './helpers/parseJson';
import locallyProcessXmlFile from './helpers/parseXML';
import { postFullImportPayload } from './helpers/postPayloads';

const useImportTrainSchedules = () => {
  const { t } = useTranslation('operational-studies', { keyPrefix: 'importTrains' });
  const dispatch = useAppDispatch();
  const { scenario, sandboxId } = useScenarioContext();
  const { upsertTrainSchedules, trainSchedules } = useTimetableContext();

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
      const { paced_trains: train_schedules, ...rest } = await postTransformTimetable({
        body: file,
      }).unwrap();
      return { ...rest, train_schedules };
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
      const rawPayload = await processFile(file);
      const timetableJsonPayload = adaptPayloadForTargetTimetable(
        rawPayload,
        scenario.timetable_type,
        [...trainSchedules.values()]
      );

      const importedTrainSchedules = await postFullImportPayload(
        sandboxId,
        scenario.timetable_id,
        scenario.id,
        timetableJsonPayload,
        subCategories,
        dispatch,
        t,
        upsertTrainSchedules
      );

      dispatch(
        setSuccess({
          title: t('success'),
          text: t('status.successfulImport', {
            count: importedTrainSchedules.length,
          }),
        })
      );
    } catch (error: unknown) {
      dispatch(setFailure(castErrorToFailure(error)));
    }
  };

  return importFile;
};

export default useImportTrainSchedules;
