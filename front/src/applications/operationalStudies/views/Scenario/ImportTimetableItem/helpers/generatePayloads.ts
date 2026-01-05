export const generateRoundTripsPayload = <T>(
  roundTripsIndexes: ([number, number] | [number, null])[],
  trainIds: { id: T }[],
  extractEditoastIdFromRoundTripId: (trainId: T) => number
) => {
  const trainScheduleOneWays: number[] = [];
  const trainScheduleRoundTrips: [number, number][] = [];

  for (const [firstIndex, secondIndex] of roundTripsIndexes) {
    if (secondIndex === null) {
      trainScheduleOneWays.push(extractEditoastIdFromRoundTripId(trainIds[firstIndex].id));
    } else {
      trainScheduleRoundTrips.push([
        extractEditoastIdFromRoundTripId(trainIds[firstIndex].id),
        extractEditoastIdFromRoundTripId(trainIds[secondIndex].id),
      ]);
    }
  }
  return {
    roundTrips: {
      one_ways: trainScheduleOneWays,
      round_trips: trainScheduleRoundTrips,
    },
  };
};
