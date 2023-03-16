import React, { FC, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { Marker } from 'react-map-gl';
import nextId from 'react-id-generator';
import originSVG from 'assets/pictures/origin.svg';
import destinationSVG from 'assets/pictures/destination.svg';
import viaSVG from 'assets/pictures/via.svg';
import { RootState } from 'reducers';
import { getVias, getOrigin, getDestination } from 'reducers/osrdconf/selectors';

const RenderItineraryMarkers: FC = () => {
  const vias = useSelector(getVias);
  const origin = useSelector(getOrigin);
  const destination = useSelector(getDestination);

  const formatPointWithNoName = (pointData: any) => (
    <>
      <div className="main-line">
        <div className="track-name">{pointData.extensions_sncf_track_name}</div>
        <div className="line-code">{pointData.extensions_sncf_line_code}</div>
      </div>
      <div className="second-line">{pointData.extensions_sncf_line_name}</div>
    </>
  );

  const markers = useMemo(() => {
    const result = [];
    if (origin !== undefined) {
      result.push(
        <Marker
          longitude={origin.clickLngLat[0]}
          latitude={origin.clickLngLat[1]}
          offset={[0, -12]}
          key={nextId()}
        >
          <img src={originSVG} alt="Origin" style={{ height: '1.5rem' }} />
          <div className="map-pathfinding-marker origin-name">
            {origin.name || formatPointWithNoName(origin)}
          </div>
        </Marker>
      );
    }
    if (destination !== undefined) {
      result.push(
        <Marker
          longitude={destination.clickLngLat[0]}
          latitude={destination.clickLngLat[1]}
          offset={[0, -24]}
          key={nextId()}
        >
          <img src={destinationSVG} alt="Destination" style={{ height: '3rem' }} />
          <div className="map-pathfinding-marker destination-name">
            {destination.name || formatPointWithNoName(destination)}
          </div>
        </Marker>
      );
    }
    if (vias.length > 0) {
      vias.forEach((via, idx) => {
        result.push(
          <Marker
            longitude={via.clickLngLat[0]}
            latitude={via.clickLngLat[1]}
            offset={[0, -12]}
            key={nextId()}
          >
            <img src={viaSVG} alt="Destination" style={{ height: '1.5rem' }} />
            <span className="map-pathfinding-marker via-number">{idx + 1}</span>
            <div
              className={`map-pathfinding-marker via-name ${
                via.duration === 0 ? '' : 'via-with-stop'
              }`}
            >
              {via.name || (via.track && via.track.split('-')[0])}
            </div>
          </Marker>
        );
      });
    }
    return result;
  }, [origin, destination, vias]);

  return <>{markers.map((marker) => marker)}</>;
};

export default RenderItineraryMarkers;
