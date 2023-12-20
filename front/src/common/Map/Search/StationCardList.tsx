import React from 'react';
import { SearchResultItemOperationalPoint } from 'common/api/osrdEditoastApi';
import StationCard from 'common/StationCard';

type StationCardsListProps = {
  operationalPoints: SearchResultItemOperationalPoint[];
  stationCHcodes: string[];
  onStationClick: (result: SearchResultItemOperationalPoint) => void;
};

const StationCardsList = ({
  operationalPoints,
  stationCHcodes,
  onStationClick,
}: StationCardsListProps) => {
  const sortByCh = (
    a: SearchResultItemOperationalPoint,
    b: SearchResultItemOperationalPoint
  ): number => {
    const aIndex = stationCHcodes.indexOf(a.ch);
    const bIndex = stationCHcodes.indexOf(b.ch);

    const aIsStation = aIndex !== -1;
    const bIsStation = bIndex !== -1;

    const aBeforeB = aIsStation && !bIsStation;
    const bBeforeA = !aIsStation && bIsStation;
    const aAndbAreStations = aIsStation && bIsStation;

    if (aBeforeB) return -1;
    if (bBeforeA) return 1;
    if (aAndbAreStations) return aIndex - bIndex;
    return 0; // Otherwise, we maintain the order returned by the backend, as the data is already sorted by name.
  };

  const sortedStations = [...operationalPoints].sort(sortByCh);

  return (
    <div className="search-results">
      {sortedStations.map((station) => (
        <div className="mb-1" key={`mapSearchStation-${station.obj_id}`}>
          <StationCard
            station={{ ...station, yardname: station.ch }}
            onClick={() => onStationClick(station)}
          />
        </div>
      ))}
    </div>
  );
};

export default StationCardsList;
