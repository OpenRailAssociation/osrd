import React from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import type { Position } from 'geojson';

import DisplayVias from 'modules/trainschedule/components/ManageTrainSchedule/Itinerary/DisplayVias';

import { useOsrdConfSelectors } from 'common/osrdContext';

interface ViasProps {
  zoomToFeaturePoint: (lngLat?: Position, id?: string) => void;
}

function Vias({ zoomToFeaturePoint }: ViasProps) {
  const { getVias } = useOsrdConfSelectors();
  const vias = useSelector(getVias);
  const { t } = useTranslation(['operationalStudies/manageTrainSchedule']);

  return (
    <div data-testid="itinerary-vias">
      <div className="vias-list mb-2">
        {vias && vias.length > 0 ? (
          <DisplayVias zoomToFeaturePoint={zoomToFeaturePoint} />
        ) : (
          <small className="ml-4">{t('noPlaceChosen')}</small>
        )}
      </div>
    </div>
  );
}

export default Vias;
