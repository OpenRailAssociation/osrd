import React, { useCallback, type FC, type HTMLAttributes } from 'react';

import { Location } from '@osrd-project/ui-icons';
import bbox from '@turf/bbox';
import type { LineString } from '@turf/helpers';
import { useTranslation } from 'react-i18next';
import { useMap } from 'react-map-gl/dist/esm/exports-maplibre';

interface IncompatibleConstraintsShowFullPathProps extends HTMLAttributes<unknown> {
  path?: LineString;
}
const IncompatibleConstraintsShowFullPath: FC<IncompatibleConstraintsShowFullPathProps> = (
  props
) => {
  const map = useMap();
  const { t } = useTranslation(['operationalStudies/manageTrainSchedule']);
  const { path, ...attrs } = props;

  const mapFocusOnPath = useCallback(() => {
    if (path) {
      map.current?.fitBounds(bbox(path) as [number, number, number, number], {
        linear: true,
      });
    }
  }, [map, path]);

  return (
    <button
      {...attrs}
      type="button"
      title={t('incompatibleConstraints.seePathOnMap')}
      onClick={mapFocusOnPath}
    >
      <Location />
      <span className="sr-only">{t('incompatibleConstraints.seePathOnMap')}</span>
    </button>
  );
};

export default IncompatibleConstraintsShowFullPath;
