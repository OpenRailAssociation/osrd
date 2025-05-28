import { Duration, addDurationToDate } from 'utils/duration';

const formatDate = (date: Date) =>
  date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'numeric',
    year: '2-digit',
  });

const formatTime = (date: Date) =>
  date.toLocaleTimeString(undefined, { hour: 'numeric', minute: 'numeric' });

/**
 * Computes the operation schedules for a given start time and duration.
 *
 * @param startTime - The ISO string representing the start time.
 * @param msFromStartTime - The duration in milliseconds from the start time.
 * @returns An object containing the origin and destination schedules.
 *
 * The function extracts the date and time from the provided ISO start time and calculates the destination arrival time
 * by adding the specified duration. It then returns an object with the origin and destination schedules, including
 * the date, time, and ISO arrival times.
 *
 * Note: A margin of 30 minutes is applied to the departure and arrival times to allow for necessary
 * activities such as preparation for the next departure.
 */
const computeOpSchedules = (startTime: Date, durationFromStartTime: Duration) => {
  const destinationArrivalTime = addDurationToDate(startTime, durationFromStartTime);

  return {
    origin: {
      date: formatDate(startTime),
      time: formatTime(startTime),
      arrivalDate: addDurationToDate(startTime, new Duration({ minutes: -30 })),
    },
    destination: {
      date: formatDate(destinationArrivalTime),
      time: formatTime(destinationArrivalTime),
      arrivalDate: addDurationToDate(destinationArrivalTime, new Duration({ minutes: 30 })),
    },
  };
};

export default computeOpSchedules;
