import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { useDispatch, useSelector } from 'react-redux';
import { setFailure } from 'reducers/main';
import { useTranslation } from 'react-i18next';
import { get } from 'common/requests';

// Buttons
import ButtonMapSearch from 'common/Map/Buttons/ButtonMapSearch';
import ButtonMapSettings from 'common/Map/Buttons/ButtonMapSettings';
import ButtonMapKey from 'common/Map/Buttons/ButtonMapKey';
import ButtonResetViewport from 'common/Map/Buttons/ButtonResetViewport';
import ButtonFullscreen from 'common/ButtonFullscreen';

// Map modals
import MapSearch from 'common/Map/Search/MapSearch';
import MapSettings from 'common/Map/Settings/MapSettings';
import MapKey from 'common/Map/MapKey';
import InfraSelectorModal from 'applications/osrd/components/InfraSelector/InfraSelectorModal';
import ButtonMapInfras from './ButtonMapInfras';

const infraURL = '/infra/';

export default function MapButtons(props) {
  const { resetPitchBearing } = props;
  const [showSearch, setShowSearch] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showMapKey, setShowMapKey] = useState(false);

  const dispatch = useDispatch();
  const [infrasList, setInfrasList] = useState(undefined);

  const { t } = useTranslation(['osrdconf']);

  const getInfrasList = async () => {
    try {
      const infrasListQuery = await get(infraURL, {});
      setInfrasList(infrasListQuery);
    } catch (e) {
      dispatch(
        setFailure({
          name: t('errorMessages.unableToRetrieveInfraList'),
          message: e.message,
        })
      );
      console.log('ERROR', e);
    }
  };

  return (
    <>
      <div className="btn-map-container">
        <ButtonMapSearch toggleMapSearch={() => setShowSearch(!showSearch)} />
        <ButtonMapSettings toggleMapSettings={() => setShowSettings(!showSettings)} />
        <ButtonMapKey toggleMapKey={() => setShowMapKey(!showMapKey)} />
        <ButtonResetViewport updateLocalViewport={resetPitchBearing} />
        <ButtonFullscreen />
        <ButtonMapInfras toggleInfraSelector={getInfrasList} />
      </div>
      <MapSearch active={showSearch} toggleMapSearch={() => setShowSearch(!showSearch)} />
      <MapSettings active={showSettings} toggleMapSettings={() => setShowSettings(!showSettings)} />
      <MapKey active={showMapKey} toggleMapKey={() => setShowMapKey(!showMapKey)} />
      <InfraSelectorModal infrasList={infrasList} from="map" />
    </>
  );
}

MapButtons.propTypes = {
  resetPitchBearing: PropTypes.func.isRequired,
};
