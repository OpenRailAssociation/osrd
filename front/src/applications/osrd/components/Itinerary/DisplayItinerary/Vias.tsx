import React from 'react';
import { useSelector } from 'react-redux';
import { Position } from 'geojson';
import { RiMapPin3Fill } from 'react-icons/ri';
import { GiPathDistance } from 'react-icons/gi';
import { useTranslation } from 'react-i18next';

import { RootState } from 'reducers';

import DisplayVias from 'applications/osrd/components/Itinerary/DisplayVias';

interface ViasProps {
  zoomToFeaturePoint: (lngLat?: Position, id?: string, source?: string) => void;
}

function Vias(props: ViasProps) {
  const { zoomToFeaturePoint } = props;
  const osrdconf = useSelector((state: RootState) => state.osrdconf);
  const { t } = useTranslation(['osrdconf']);

  const viasTitle = (
    <h2 className="d-flex align-items-center mb-0 ml-4">
      <span className="mr-1 h2 text-info">
        <RiMapPin3Fill />
      </span>
      <span>{t('osrdconf:vias')}</span>
      <button
        className="btn btn-info btn-only-icon btn-sm ml-1"
        type="button"
        data-toggle="modal"
        data-target="#suggeredViasModal"
      >
        <GiPathDistance />
      </button>
    </h2>
  );
  return (
    <>
      {viasTitle}
      <div className="mb-3">
        {osrdconf.vias.length > 0 ? (
          <DisplayVias zoomToFeaturePoint={zoomToFeaturePoint} />
        ) : (
          <small className="ml-4">{t('osrdconf:noplacechosen')}</small>
        )}
      </div>
    </>
  );
}

export default Vias;
