import { useCallback, type HTMLAttributes } from 'react';

import { Location } from '@osrd-project/ui-icons';
import bbox from '@turf/bbox';
import type { FeatureCollection, LineString } from 'geojson';
import { useTranslation } from 'react-i18next';
import { useMap } from 'react-map-gl/maplibre';

import { useMapSettings } from 'reducers/commonMap';

type IncompatibleConstraintsMapFocusProps = HTMLAttributes<unknown> & {
  geojson?: FeatureCollection<LineString>;
};

const IncompatibleConstraintsMapFocus = (props: IncompatibleConstraintsMapFocusProps) => {
  const map = useMap();
  const { smoothTravel } = useMapSettings();
  const { t } = useTranslation('operational-studies', { keyPrefix: 'manageTimetableItem' });
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
