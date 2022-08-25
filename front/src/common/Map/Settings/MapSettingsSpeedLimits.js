import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useSelector, useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { updateLayersSettings } from 'reducers/map';
import { IoMdSpeedometer } from 'react-icons/io';
import SwitchSNCF, { SWITCH_TYPES } from 'common/BootstrapSNCF/SwitchSNCF/SwitchSNCF';
import SelectImprovedSNCF from 'common/BootstrapSNCF/SelectImprovedSNCF';
import DotsLoader from 'common/DotsLoader/DotsLoader';
import { get } from 'common/requests.ts';
import { setFailure } from 'reducers/main.ts';

const FormatSwitch = (props) => {
  const dispatch = useDispatch();
  const { t } = useTranslation(['map-settings']);
  const { layersSettings } = useSelector((state) => state.map);
  const { infraID } = useSelector((state) => state.osrdconf);
  const [speedLimitsTags, setSpeedLimitsTags] = useState(undefined);
  const {
    name, icon, color, disabled = false,
  } = props;

  const setLayerSettings = (setting) => {
    dispatch(updateLayersSettings({
      ...layersSettings,
      [setting]: !layersSettings[setting],
    }));
  };

  const dispatchSetSpeedLimitsTags = (item) => {
    dispatch(updateLayersSettings({
      ...layersSettings,
      speedlimittag: item,
    }));
  };

  const getTagsList = async (zoom, params) => {
    try {
      const tagsList = await get(`/infra/${infraID}/speed_limit_tags/`, params, {}, true);
      setSpeedLimitsTags([t('noSpeedLimitByTag')].concat(tagsList));
    } catch (e) {
      dispatch(setFailure({
        name: t('errorMessages.unableToRetrieveTags'),
        message: `${e.message} : ${e.response && e.response.data.detail}`,
      }));
      console.log('ERROR', e);
    }
  };

  useEffect(() => {
    getTagsList();
  }, []);

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
          <span className={`px-1 d-flex align-items-center ${color}`}>
            {icon}
          </span>
          <small>{t(name)}</small>
        </div>
      </div>
      <div className="col-lg-6">
        {speedLimitsTags ? (
          <SelectImprovedSNCF
            options={speedLimitsTags}
            onChange={dispatchSetSpeedLimitsTags}
            selectedValue={layersSettings.speedlimittag}
            sm
            withSearch
          />
        ) : <span className="ml-3"><DotsLoader /></span> }
      </div>
    </>
  );
};

export default function MapSettingsLayers() {
  return (
    <div className="row">
      <FormatSwitch
        name="speedlimits"
        icon={<IoMdSpeedometer />}
      />
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
