import React from 'react';
import { useSelector } from 'react-redux';
import { Position } from 'geojson';
import { useTranslation } from 'react-i18next';

import DisplayVias from 'modules/trainschedule/components/ManageTrainSchedule/Itinerary/DisplayVias';
import { useModal } from 'common/BootstrapSNCF/ModalSNCF';
import { getGeojson, getVias } from 'reducers/osrdconf/selectors';
import { FaPlus } from 'react-icons/fa';

interface ViasProps {
  zoomToFeaturePoint: (lngLat?: Position, id?: string) => void;
  viaModalContent: JSX.Element;
}

function Vias(props: ViasProps) {
  const { zoomToFeaturePoint, viaModalContent } = props;
  const vias = useSelector(getVias);
  const { t } = useTranslation(['operationalStudies/manageTrainSchedule']);
  const geojson = useSelector(getGeojson);
  const { openModal } = useModal();

  return (
    <div data-testid="itinerary-vias">
      {geojson && (
        <button
          className="btn btn-link text-cyan w-100 justify-content-center btn-sm"
          type="button"
          onClick={() => openModal(viaModalContent)}
        >
          <span className="mr-2">{t('addVias')}</span>
          <FaPlus />
        </button>
      )}
      <div className="vias-list">
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
