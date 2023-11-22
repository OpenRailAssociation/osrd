import React from 'react';
import { useSelector } from 'react-redux';
import { Position } from 'geojson';
import { useTranslation } from 'react-i18next';
import DisplayVias from 'modules/trainschedule/components/ManageTrainSchedule/Itinerary/DisplayVias';
import { getVias } from 'reducers/osrdconf/selectors';

interface ViasProps {
  zoomToFeaturePoint: (lngLat?: Position, id?: string) => void;
}

function Vias(props: ViasProps) {
  const { zoomToFeaturePoint } = props;
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
