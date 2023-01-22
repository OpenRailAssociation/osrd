import React, { useContext } from 'react';
import { useSelector } from 'react-redux';
import { Position } from 'geojson';
import { RiMapPin3Fill } from 'react-icons/ri';
import { GiPathDistance } from 'react-icons/gi';
import { useTranslation } from 'react-i18next';

import { getVias } from 'reducers/osrdconf/selectors';

import DisplayVias from 'applications/operationalStudies/components/ManageTrainSchedule/Itinerary/DisplayVias';
import { RootState } from 'reducers';
import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';

interface ViasProps {
  zoomToFeaturePoint: (lngLat?: Position, id?: string, source?: string) => void;
  viaModalContent: string;
}

function Vias(props: ViasProps) {
  const { zoomToFeaturePoint, viaModalContent } = props;
  const vias = useSelector(getVias);
  const { t } = useTranslation(['operationalStudies/manageTrainSchedule']);
  const osrdconf = useSelector((state: RootState) => state.osrdconf);
  const { openModal } = useContext(ModalContext);

  const viasTitle = (
    <h2 className="d-flex align-items-center mb-0 ml-4">
      <span className="mr-1 h2 text-info">
        <RiMapPin3Fill />
      </span>
      <span>{t('vias')}</span>
      <button
        className={`btn btn-info btn-only-icon btn-sm ml-1 ${osrdconf.geojson ? '' : 'disabled'}`}
        type="button"
        onClick={() => openModal(viaModalContent)}
      >
        <GiPathDistance />
      </button>
    </h2>
  );
  return (
    <>
      {viasTitle}
      <div className="mb-3">
        {vias.length > 0 ? (
          <DisplayVias zoomToFeaturePoint={zoomToFeaturePoint} />
        ) : (
          <small className="ml-4">{t('noplacechosen')}</small>
        )}
      </div>
    </>
  );
}

export default Vias;
