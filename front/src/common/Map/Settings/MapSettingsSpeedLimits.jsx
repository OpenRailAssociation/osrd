import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useSelector, useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { updateLayersSettings } from 'reducers/map';
import { IoMdSpeedometer } from 'react-icons/io';
import SwitchSNCF, { SWITCH_TYPES } from 'common/BootstrapSNCF/SwitchSNCF/SwitchSNCF';
import SelectImprovedSNCF from 'common/BootstrapSNCF/SelectImprovedSNCF';
import DotsLoader from 'common/DotsLoader/DotsLoader';
import { get } from 'common/requests';
import { setFailure } from 'reducers/main';
import TIVsSVGFile from 'assets/pictures/layersicons/layer_tivs.svg';
import { FormatSwitch as SimpleFormatSwitch, Icon2SVG } from './MapSettingsLayers';

function FormatSwitch(props) {
  const dispatch = useDispatch();
  const { t } = useTranslation(['map-settings']);
  const { layersSettings } = useSelector((state) => state.map);
  const { infraID } = useSelector((state) => state.osrdconf);
  const [speedLimitsTags, setSpeedLimitsTags] = useState(undefined);
  const { name, icon, color, disabled = false } = props;

  const setLayerSettings = (setting) => {
    dispatch(
      updateLayersSettings({
        ...layersSettings,
        [setting]: !layersSettings[setting],
      })
    );
  };

  const dispatchSetSpeedLimitsTags = (item) => {
    dispatch(
      updateLayersSettings({
        ...layersSettings,
        speedlimittag: item.key,
      })
    );
  };

  const getTagsList = async (_zoom, _params) => {
    try {
      const tagsList = await get(`/editoast/infra/${infraID}/speed_limit_tags/`);

      // construct an object from array to add "undefined" value
      const tagsListObject = [{ key: 'undefined', value: t('noSpeedLimitByTag') }].concat(
        tagsList.map((tag) => ({ key: tag, value: tag }))
      );

      setSpeedLimitsTags(tagsListObject);
    } catch (e) {
      dispatch(
        setFailure({
          name: t('errorMessages.unableToRetrieveTags'),
          message: `${e.message} : ${e.response && e.response.data.detail}`,
        })
      );
      console.log('ERROR', e);
    }
  };

  useEffect(() => {
    setSpeedLimitsTags(undefined);
    getTagsList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [infraID]);

  return (
    <>
      <div className="col-lg-6">
        <div className="d-flex align-items-center mt-2">
          <SwitchSNCF
            id={`${name}-switch`}
            type={SWITCH_TYPES.switch}
            name={`${name}-switch`}
            onChange={() => setLayerSettings(name)}
            checked={layersSettings[name]}
            disabled={disabled}
          />
          <span className={`px-1 d-flex align-items-center ${color}`}>{icon}</span>
          <small>{t(name)}</small>
        </div>
      </div>
      <div className="col-lg-6 pt-1">
        {speedLimitsTags ? (
          <SelectImprovedSNCF
            options={speedLimitsTags}
            onChange={dispatchSetSpeedLimitsTags}
            selectedValue={layersSettings.speedlimittag}
            sm
            withSearch
          />
        ) : (
          <span className="ml-3">
            <DotsLoader />
          </span>
        )}
      </div>
    </>
  );
}

export default function MapSettingsLayers() {
  return (
    <div className="row">
      <FormatSwitch name="speedlimits" icon={<IoMdSpeedometer />} />
      <div className="col-lg-6">
        <SimpleFormatSwitch name="sncf_lpv" icon={Icon2SVG(TIVsSVGFile, 'SNCF LPV TIV icon svg')} />
      </div>
    </div>
  );
}

FormatSwitch.propTypes = {
  name: PropTypes.string.isRequired,
  icon: PropTypes.object.isRequired,
  color: PropTypes.string,
  disabled: PropTypes.bool,
};
FormatSwitch.defaultProps = {
  color: '',
  disabled: false,
};
