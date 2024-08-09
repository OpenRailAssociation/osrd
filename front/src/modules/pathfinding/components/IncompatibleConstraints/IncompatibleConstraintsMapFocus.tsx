import { useCallback, type HTMLAttributes } from 'react';

import { Location } from '@osrd-project/ui-icons';
import bbox from '@turf/bbox';
import type { FeatureCollection, LineString } from '@turf/helpers';
import { useTranslation } from 'react-i18next';
import { useMap } from 'react-map-gl/maplibre';
import { useSelector } from 'react-redux';

import { getMap } from 'reducers/map/selectors';

interface IncompatibleConstraintsMapFocusProps extends HTMLAttributes<unknown> {
  geojson?: FeatureCollection<LineString, unknown>;
}

const IncompatibleConstraintsMapFocus = (props: IncompatibleConstraintsMapFocusProps) => {
  const map = useMap();
  const { smoothTravel } = useSelector(getMap);
  const { t } = useTranslation(['operationalStudies/manageTrainSchedule']);
  const { geojson, ...attrs } = props;

  const mapFocusOnPath = useCallback(() => {
    if (geojson) {
      map.current?.fitBounds(bbox(geojson) as [number, number, number, number], {
        animate: smoothTravel,
      });
    }
  }, [map, geojson, smoothTravel]);

  return (
    <button
      {...attrs}
      type="button"
      title={t('incompatibleConstraints.seeConstraintsOnMap')}
      onClick={mapFocusOnPath}
    >
      <Location />
      <span className="sr-only">{t('incompatibleConstraints.seeConstraintsOnMap')}</span>
    </button>
  );
};

export default IncompatibleConstraintsMapFocus;
