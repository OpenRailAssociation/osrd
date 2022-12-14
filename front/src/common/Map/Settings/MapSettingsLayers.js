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

export function FormatSwitch(props) {
  const dispatch = useDispatch();
  const { t } = useTranslation(['map-settings']);
  const { layersSettings } = useSelector((state) => state.map);
  const { name, icon, color, disabled = false } = props;

  const setLayerSettings = (setting) => {
    dispatch(
      updateLayersSettings({
        ...layersSettings,
        [setting]: !layersSettings[setting],
      })
    );
  };

  return (
    <div className="d-flex align-items-center mt-1">
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
  );
}

export function Icon2SVG(file, altName) {
  return <img src={file} alt={altName} height="16" />;
}

export default function MapSettingsLayers() {
  return (
    <div className="row">
      <div className="col-md-6">
        <FormatSwitch name="catenaries" icon={<GiElectric />} />
      </div>
      <div className="col-md-6">
        <FormatSwitch name="signalingtype" icon={<AiOutlineBlock />} disabled />
      </div>
      <div className="col-md-6">
        <FormatSwitch name="tvds" icon={<MdSpaceBar />} disabled />
      </div>
      <div className="col-md-6">
        <FormatSwitch name="routes" icon={<MdLinearScale />} color="text-orange" />
      </div>
      <div className="col-md-6">
        <FormatSwitch
          name="operationalpoints"
          icon={Icon2SVG(OPsSVGFile, 'Operationnal points svg')}
        />
      </div>
      <div className="col-md-6">
        <FormatSwitch name="switches" icon={Icon2SVG(SwitchesSVGFile, 'Switches icon svg')} />
      </div>
      <div className="col-md-6">
        <FormatSwitch name="bufferstops" icon={Icon2SVG(BufferStopSVGFile, 'Buffer stop svg')} />
      </div>
      <div className="col-md-6">
        <FormatSwitch name="detectors" icon={Icon2SVG(DetectorsSVGFile, 'Detectors circles svg')} />
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
