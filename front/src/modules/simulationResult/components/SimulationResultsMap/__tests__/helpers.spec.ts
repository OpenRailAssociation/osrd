import { PositionsSpeedTimes } from 'reducers/osrdsimulation/types';
import { lineString } from 'test-data/geojson';
import { getSimulationHoverPositions } from '../helpers';

describe('getSimulationHoverPositions', () => {
  const allowancesSettings = {
    '1': {
      base: true,
      baseBlocks: true,
      eco: true,
      ecoBlocks: false,
    },
  };
  it('should not crash when headPosition exists but tailPosition does not', () => {
    const path = lineString();
    const simulation = { trains: [] };
    const date = new Date();
    const positionValues = { headPosition: { position: 555 } } as PositionsSpeedTimes<Date>;
    const trainId = 1;
    const result = getSimulationHoverPositions(
      path,
      simulation,
      date,
      positionValues,
      trainId,
      allowancesSettings
    );
    expect(result).toEqual([]);
  });
});
