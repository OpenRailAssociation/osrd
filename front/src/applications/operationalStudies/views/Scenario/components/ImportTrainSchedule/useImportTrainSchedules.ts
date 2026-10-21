import { isObject } from 'lodash';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { useScenarioContext } from 'applications/operationalStudies/hooks/useScenarioContext';
import { useTimetableContext } from 'applications/operationalStudies/hooks/useTimetableContext';
import type { TimetableJsonPayload } from 'applications/operationalStudies/types';
import { convertNgeDtoToOsrd } from 'applications/operationalStudies/views/Scenario/components/MacroEditor/ngeToOsrd';
import { osrdRailwayManagerApi } from 'common/api/osrdRailwayManagerApi';
import { useSubCategoryContext } from 'common/SubCategoryContext';
import { computeHourlyTimetableDuration } from 'modules/trainSchedule/helpers/hourlyTimetable';
import { setFailure, setSuccess } from 'reducers/main';
import { getRailwayManagerInterfaceUrl } from 'reducers/main/mainSelector';
import { useAppDispatch } from 'store';
import { castErrorToFailure } from 'utils/error';

import { adaptPayloadForTargetTimetable, getPayloadTimetableType } from './helpers/adaptJsonImport';
import { isNgeDto, processJsonFile } from './helpers/parseJson';
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

  // TODO: adapt once the front handles multiple timetable per scenario
  const timetableId = scenario.timetable_summaries[0].id;
  const timetableType = scenario.timetable_summaries[0].type;

  const processFile = async (file: File): Promise<TimetableJsonPayload> => {
    const fileContent = await file.text();
    const jsonContent = processJsonFile(fileContent, file.type, t);
    if (jsonContent === null) return await processXmlFile(file, fileContent);
    if (isNgeDto(jsonContent)) {
      return convertNgeDtoToOsrd(jsonContent, {
        timetableType,
        hourlyTimetableDuration: computeHourlyTimetableDuration([...trainSchedules.values()]),
      });
    }
    return jsonContent;
  };

  const importFile = async (file: File) => {
    try {
      const rawPayload = await processFile(file);
      const timetableJsonPayload =
        getPayloadTimetableType(rawPayload) === timetableType
          ? rawPayload
          : adaptPayloadForTargetTimetable(rawPayload, timetableType, [...trainSchedules.values()]);

      const importedTrainSchedules = await postFullImportPayload(
        sandboxId,
        timetableId,
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
