import { useCallback, type HTMLAttributes, type SyntheticEvent } from 'react';

import { Location } from '@osrd-project/ui-icons';
import bbox from '@turf/bbox';
import type { FeatureCollection, LineString } from 'geojson';
import { useTranslation } from 'react-i18next';
import { useMap } from 'react-map-gl/maplibre';

type IncompatibleConstraintsMapFocusProps = HTMLAttributes<unknown> & {
  geojson?: FeatureCollection<LineString>;
};

const IncompatibleConstraintsMapFocus = (props: IncompatibleConstraintsMapFocusProps) => {
  const map = useMap();
  const { t } = useTranslation('operational-studies', { keyPrefix: 'manageTrainSchedule' });
  const { geojson, ...attrs } = props;

  const mapFocusOnPath = useCallback(
    (e: SyntheticEvent) => {
      e.stopPropagation();
      if (geojson) {
        map.current?.fitBounds(bbox(geojson) as [number, number, number, number]);
      }
    },
    [map, geojson]
  );

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
