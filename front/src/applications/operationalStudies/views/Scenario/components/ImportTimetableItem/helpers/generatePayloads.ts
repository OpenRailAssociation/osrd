export const generateRoundTripsPayload = (
  roundTripsIndexes: ([number, number] | [number, null])[],
  trainIds: { id: number }[]
) => {
  const trainScheduleOneWays: number[] = [];
  const trainScheduleRoundTrips: [number, number][] = [];

  for (const [firstIndex, secondIndex] of roundTripsIndexes) {
    if (secondIndex === null) {
      trainScheduleOneWays.push(trainIds[firstIndex].id);
    } else {
      trainScheduleRoundTrips.push([trainIds[firstIndex].id, trainIds[secondIndex].id]);
    }
  }
  return {
    roundTrips: {
      one_ways: trainScheduleOneWays,
      round_trips: trainScheduleRoundTrips,
    },
  };
};
