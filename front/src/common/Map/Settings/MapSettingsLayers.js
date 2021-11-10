import React from 'react';
import PropTypes from 'prop-types';
import { useSelector, useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { updateLayersSettings } from 'reducers/map';
import { GiElectric } from 'react-icons/gi';
import { IoMdSpeedometer } from 'react-icons/io';
import { AiOutlineBlock } from 'react-icons/ai';
import { MdSpaceBar } from 'react-icons/md';
import { FaMapMarkerAlt } from 'react-icons/fa';
import SwitchSNCF, { SWITCH_TYPES } from 'common/BootstrapSNCF/SwitchSNCF/SwitchSNCF';

const FormatSwitch = (props) => {
  const dispatch = useDispatch();
  const { t } = useTranslation(['map-settings']);
  const { layersSettings } = useSelector((state) => state.map);
  const { name, icon, color } = props;

  const setLayerSettings = (setting) => {
    dispatch(updateLayersSettings({
      ...layersSettings,
      [setting]: !layersSettings[setting],
    }));
  };

  return (
    <div className="col-lg-6">
      <div className="d-flex align-items-center mt-2">
        <SwitchSNCF
          id={`${name}-switch`}
          type={SWITCH_TYPES.switch}
          name={`${name}-switch`}
          onChange={() => setLayerSettings(name)}
          checked={layersSettings[name]}
        />
        <span className={`px-1 d-flex align-items-center ${color}`}>
          {icon}
        </span>
        <small>{t(name)}</small>
      </div>
    </div>
  );
};

export default function MapSettingsLayers() {
  return (
    <div className="row">
      <FormatSwitch
        name="electrification"
        icon={<GiElectric />}
      />
      <FormatSwitch
        name="signalingtype"
        icon={<AiOutlineBlock />}
      />
      <FormatSwitch
        name="speedlimits"
        icon={<IoMdSpeedometer />}
      />
      <FormatSwitch
        name="speedlimitscolor"
        icon={<IoMdSpeedometer />}
        color="text-green"
      />
      <FormatSwitch
        name="tvds"
        icon={<MdSpaceBar />}
      />
      <FormatSwitch
        name="operationalpoints"
        icon={<FaMapMarkerAlt />}
      />
    </div>
  );
}

FormatSwitch.propTypes = {
  name: PropTypes.string.isRequired,
  icon: PropTypes.object.isRequired,
  color: PropTypes.string,
};
FormatSwitch.defaultProps = {
  color: '',
};
