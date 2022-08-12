import React from 'react';
import PropTypes from 'prop-types';
import { useSelector, useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { updateLayersSettings } from 'reducers/map';
import { GiElectric } from 'react-icons/gi';
import { AiOutlineBlock } from 'react-icons/ai';
import { MdSpaceBar, MdLinearScale } from 'react-icons/md';
import BufferStopSVGFile from 'assets/pictures/layersicons/bufferstop.svg';
import OPsSVGFile from 'assets/pictures/layersicons/ops.svg';
import SwitchesSVGFile from 'assets/pictures/layersicons/switches.svg';
import DetectorsSVGFile from 'assets/pictures/layersicons/detectors.svg';
import SwitchSNCF, { SWITCH_TYPES } from 'common/BootstrapSNCF/SwitchSNCF/SwitchSNCF';

const FormatSwitch = (props) => {
  const dispatch = useDispatch();
  const { t } = useTranslation(['map-settings']);
  const { layersSettings } = useSelector((state) => state.map);
  const {
    name, icon, color, disabled = false,
  } = props;

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
          disabled={disabled}
        />
        <span className={`px-1 d-flex align-items-center ${color}`}>
          {icon}
        </span>
        <small>{t(name)}</small>
      </div>
    </div>
  );
};

const BufferStopSVG = () => (
  <>
    <img src={BufferStopSVGFile} alt="Buffer stop icon" height="16" />
  </>
);
const DetectorsSVG = () => (
  <>
    <img src={DetectorsSVGFile} alt="Buffer stop icon" height="16" />
  </>
);
const OPsSVG = () => (
  <>
    <img src={OPsSVGFile} alt="Buffer stop icon" height="16" />
  </>
);
const SwitchesSVG = () => (
  <>
    <img src={SwitchesSVGFile} alt="Buffer stop icon" height="16" />
  </>
);

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
        disabled
      />
      <FormatSwitch
        name="tvds"
        icon={<MdSpaceBar />}
        disabled
      />
      <FormatSwitch
        name="routes"
        icon={<MdLinearScale />}
        color="text-orange"
      />
      <FormatSwitch
        name="operationalpoints"
        icon={<OPsSVG />}
      />
      <FormatSwitch
        name="switches"
        icon={<SwitchesSVG />}
      />
      <FormatSwitch
        name="bufferstops"
        icon={<BufferStopSVG />}
      />
      <FormatSwitch
        name="detectors"
        icon={<DetectorsSVG />}
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
