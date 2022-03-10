import { get, patch } from 'common/requests';

const trainScheduleURI = '/train_schedule';

/**
 * Use the trainScheduleAPI to update train details on a specific computation
 *
 * @export
 * @param {object} details
 * @param {int} id
 */
export async function changeTrain(details, id) {
  try {
    const trainDetail = await get(`${trainScheduleURI}/${id}/`);
    try {
      const params = {
        id,
        departure_time: details.departure_time || trainDetail.departure_time,
        initial_speed: details.initial_speed || trainDetail.initial_speed,
        labels: details.labels || trainDetail.labels,
        path: details.path || trainDetail.path,
        rolling_stock: details.rolling_stock || trainDetail.rolling_stock,
        timetable: details.timetable || trainDetail.timetable,
        train_name: details.train_name || trainDetail.train_name,
      };
      await patch(`${trainScheduleURI}/${id}/`, params);
    } catch (e) {
      console.log('ERROR', e);
    }
  } catch (e) {
    console.log('ERROR', e);
  }
}
