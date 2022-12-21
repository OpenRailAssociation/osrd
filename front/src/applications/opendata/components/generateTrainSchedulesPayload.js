import { time2sec } from 'utils/timeManipulation';

export default function generateTrainSchedulesPayload(trainsWithPathRef, infraID, timetableID) {
  const trainSchedulesByPathID = {};
  trainsWithPathRef.forEach((train) => {
    if (!trainSchedulesByPathID[train.pathId]) {
      trainSchedulesByPathID[train.pathId] = {
        timetable: timetableID,
        path: train.pathId,
        schedules: [],
      };
    }
    trainSchedulesByPathID[train.pathId].schedules.push({
      train_name: train.num,
      rolling_stock: train.rollingStockId,
      departure_time: time2sec(train.debut),
      initial_speed: 0,
    });
  });
  return trainSchedulesByPathID;
}
