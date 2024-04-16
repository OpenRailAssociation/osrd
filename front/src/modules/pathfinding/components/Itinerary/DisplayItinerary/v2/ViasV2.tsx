import React from 'react';

import type { Position } from 'geojson';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { useOsrdConfSelectors } from 'common/osrdContext';
import DisplayViasV2 from 'modules/pathfinding/components/Itinerary/DisplayViasV2';

type ViasProps = {
  zoomToFeaturePoint: (lngLat?: Position, id?: string) => void;
};

const ViasV2 = ({ zoomToFeaturePoint }: ViasProps) => {
  const { getViasV2 } = useOsrdConfSelectors();
  const vias = useSelector(getViasV2());
  const { t } = useTranslation(['operationalStudies/manageTrainSchedule']);

  return (
    <div data-testid="itinerary-vias">
      <div className="vias-list mb-2">
        {vias && vias.length > 0 ? (
          <DisplayViasV2 zoomToFeaturePoint={zoomToFeaturePoint} />
        ) : (
          <small className="ml-4">{t('noPlaceChosen')}</small>
        )}
      </div>
    </div>
  );
};

export default ViasV2;
