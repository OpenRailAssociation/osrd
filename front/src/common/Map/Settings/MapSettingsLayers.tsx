import { type ReactNode, useCallback } from 'react';

import { useTranslation } from 'react-i18next';
import { GiElectric, GiUnplugged } from 'react-icons/gi';
import { TbRectangleVerticalFilled } from 'react-icons/tb';

import BufferStopSVGFile from 'assets/pictures/layersicons/bufferstop.svg';
import DetectorsSVGFile from 'assets/pictures/layersicons/detectors.svg';
import SignalsSVGFile from 'assets/pictures/layersicons/layer_signal.svg';
import OPsSVGFile from 'assets/pictures/layersicons/ops.svg';
import SwitchesSVGFile from 'assets/pictures/layersicons/switches.svg';
import SwitchSNCF, { SWITCH_TYPES } from 'common/BootstrapSNCF/SwitchSNCF';
import { useMapSettings, useMapSettingsActions } from 'reducers/commonMap';
import type { MapSettings } from 'reducers/commonMap/types';
import { useAppDispatch } from 'store';

type LayerSettings = MapSettings['layersSettings'];

type FormatSwitchProps = {
  name: keyof Omit<LayerSettings, 'speedlimittag'>;
  icon: ReactNode;
  color?: string;
  disabled?: boolean;
};

export const FormatSwitch = ({ name, icon, color, disabled }: FormatSwitchProps) => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation();
  const { layersSettings } = useMapSettings();
  const { updateLayersSettings } = useMapSettingsActions();

  const setLayerSettings = useCallback(
    (setting: keyof LayerSettings) => {
      dispatch(
        updateLayersSettings({
          [setting]: !layersSettings[setting],
        })
      );
    },
    [dispatch, layersSettings]
  );

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
      <small>{t(`mapSettings.layers.${name}`)}</small>
    </div>
  );
};

type Icon2SVGProps = {
  file: string;
  altName?: string;
  style?: React.CSSProperties;
  className?: string;
};

export const Icon2SVG = ({ file, altName, style, className }: Icon2SVGProps) => (
  <img className={className || 'icon-to-svg'} src={file} alt={altName} style={style} />
);

const MapSettingsLayers = () => (
  <div className="row mt-2">
    <div className="col-md-6">
      <FormatSwitch name="signals" icon={<Icon2SVG file={SignalsSVGFile} altName="Signal svg" />} />
    </div>
    <div className="col-md-6">
      <FormatSwitch name="electrifications" icon={<GiElectric />} />
    </div>
    <div className="col-md-6">
      <FormatSwitch name="neutral_sections" icon={<GiUnplugged />} />
    </div>
    <div className="col-md-6">
      <FormatSwitch
        name="operational_points"
        icon={<Icon2SVG file={OPsSVGFile} altName="Operationnal points svg" />}
      />
    </div>
    <div className="col-md-6">
      <FormatSwitch
        name="switches"
        icon={<Icon2SVG file={SwitchesSVGFile} altName="Switches icon svg" />}
      />
    </div>
    <div className="col-md-6">
      <FormatSwitch
        name="buffer_stops"
        icon={<Icon2SVG file={BufferStopSVGFile} altName="Buffer stop svg" />}
      />
    </div>
    <div className="col-md-6">
      <FormatSwitch
        name="detectors"
        icon={<Icon2SVG file={DetectorsSVGFile} altName="Detectors circles svg" />}
      />
    </div>
    <div className="col-md-6">
      <FormatSwitch name="platforms" icon={<TbRectangleVerticalFilled />} />
    </div>
  </div>
);

export default MapSettingsLayers;
