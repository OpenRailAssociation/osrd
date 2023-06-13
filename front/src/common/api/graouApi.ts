import get from 'axios';

import { TrainScheduleImportConfig } from 'applications/operationalStudies/types';

export const GRAOU_URL = 'https://graou.info';

export const getGraouTrainSchedules = async (config: TrainScheduleImportConfig) => {
    const params = {
        q: 'trains',
        config,
      };
    try {
        const result = await get(`${GRAOU_URL}/api/trainschedules.php`, { params });
        return result.data;
    } catch (error) {
        console.error(error);
    }
}
