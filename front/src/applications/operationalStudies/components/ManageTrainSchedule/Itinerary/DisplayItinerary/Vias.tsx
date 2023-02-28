import React, { ComponentType, useContext } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Position } from 'geojson';
import { RiMapPin3Fill } from 'react-icons/ri';
import { GiPathDistance } from 'react-icons/gi';
import { useTranslation } from 'react-i18next';

import { getVias, getGeojson } from 'reducers/osrdconf/selectors';
import {
  getVias as getViasStdcm,
  getGeojson as getGeoJsonStdcm,
} from 'reducers/osrdStdcmConf/selectors';

import DisplayVias from 'applications/operationalStudies/components/ManageTrainSchedule/Itinerary/DisplayVias';

import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import { Dispatch } from 'redux';
import { PointOnMap } from 'applications/operationalStudies/consts';

interface ViasProps {
  zoomToFeaturePoint?: (lngLat?: Position, id?: string, source?: string) => void;
  viaModalContent: string | JSX.Element;
  dispatch?: Dispatch;
  vias?: PointOnMap[];
  t?: (s: string) => string;
  osrdConfGeoJson?: string;
}

export function withStdcmData<T>(Component: ComponentType<T>) {
  return (hocProps: ViasProps) => {
    const dispatch = useDispatch();
    const vias = useSelector(getVias);
    const { t } = useTranslation(['operationalStudies/manageTrainSchedule']);
    const isOsrdConfGeoJson = useSelector(getGeojson);
    return (
      <Component
        {...(hocProps as T)}
        dispatch={dispatch}
        isOsrdConfGeoJson={isOsrdConfGeoJson}
        vias={vias}
        t={t}
      />
    );
  };
}

export function withOSRDSimulationData<T>(Component: ComponentType<T>) {
  return (hocProps: ViasProps) => {
    const dispatch = useDispatch();
    const vias = useSelector(getVias);
    const { t } = useTranslation(['operationalStudies/manageTrainSchedule']);
    const isOsrdConfGeoJson = useSelector(getGeojson);
    return (
      <Component
        {...(hocProps as T)}
        dispatch={dispatch}
        isOsrdConfGeoJson={isOsrdConfGeoJson}
        vias={vias}
        t={t}
      />
    );
  };
}

function Vias(props: ViasProps) {
  const {
    zoomToFeaturePoint = () => null,
    viaModalContent,
    dispatch,
    t = () => null,
    osrdConfGeoJson,
    vias = [],
  } = props;

  const { openModal } = useContext(ModalContext);

  const viasTitle = (
    <h2 className="d-flex align-items-center mb-0 ml-4">
      <span className="mr-1 h2 text-info">
        <RiMapPin3Fill />
      </span>
      <span>{t('vias')}</span>
      <button
        className={`btn btn-info btn-only-icon btn-sm ml-1 ${osrdConfGeoJson ? '' : 'disabled'}`}
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
        {vias?.length > 0 ? (
          <DisplayVias zoomToFeaturePoint={zoomToFeaturePoint} />
        ) : (
          <small className="ml-4">{t('noplacechosen')}</small>
        )}
      </div>
    </>
  );
}

export default Vias;
