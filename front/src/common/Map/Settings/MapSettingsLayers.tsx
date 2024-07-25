import React, { type FC, type ReactNode, useCallback } from 'react';

import { useTranslation } from 'react-i18next';
import { GiElectric, GiUnplugged } from 'react-icons/gi';
import { TbRectangleVerticalFilled } from 'react-icons/tb';
import { useSelector } from 'react-redux';

import BufferStopSVGFile from 'assets/pictures/layersicons/bufferstop.svg';
import DetectorsSVGFile from 'assets/pictures/layersicons/detectors.svg';
import SignalsSVGFile from 'assets/pictures/layersicons/layer_signal.svg';
import OPsSVGFile from 'assets/pictures/layersicons/ops.svg';
import TrackNodesSVGFile from 'assets/pictures/layersicons/track_nodes.svg';
import SwitchSNCF, { switch_types } from 'common/BootstrapSNCF/SwitchSNCF/SwitchSNCF';
import type { RootState } from 'reducers';
import { updateLayersSettings } from 'reducers/map';
import { getMap } from 'reducers/map/selectors';
import { useAppDispatch } from 'store';

type LayerSettings = RootState['map']['layersSettings'];

interface FormatTrackNodeProps {
  name: keyof Omit<LayerSettings, 'speedlimittag'>;
  icon: ReactNode;
  color?: string;
  disabled?: boolean;
}
export const FormatTrackNode: FC<FormatTrackNodeProps> = ({ name, icon, color, disabled }) => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation(['map-settings']);
  const { layersSettings } = useSelector(getMap);

  const setLayerSettings = useCallback(
    (setting: keyof LayerSettings) => {
      dispatch(
        updateLayersSettings({
          ...layersSettings,
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
        type={switch_types.switch}
        name={`${name}-switch`}
        onChange={() => setLayerSettings(name)}
        checked={layersSettings[name]}
        disabled={disabled}
      />
      <span className={`px-1 d-flex align-items-center ${color}`}>{icon}</span>
      <small>{t(name)}</small>
    </div>
  );
};

export const Icon2SVG: FC<{
  file: string;
  altName?: string;
  style?: React.CSSProperties;
  className?: string;
}> = ({ file, altName, style, className }) => (
  <img className={className || 'icon-to-svg'} src={file} alt={altName} style={style} />
);

const MapSettingsLayers: FC<unknown> = () => (
  <div className="row mt-2">
    <div className="col-md-6">
      <FormatTrackNode name="signals" icon={<Icon2SVG file={SignalsSVGFile} altName="Signal svg" />} />
    </div>
    <div className="col-md-6">
      <FormatTrackNode name="electrifications" icon={<GiElectric />} />
    </div>
    <div className="col-md-6">
      <FormatTrackNode name="neutral_sections" icon={<GiUnplugged />} />
    </div>
    <div className="col-md-6">
      <FormatTrackNode
        name="operationalpoints"
        icon={<Icon2SVG file={OPsSVGFile} altName="Operationnal points svg" />}
      />
    </div>
    <div className="col-md-6">
      <FormatTrackNode
        name="track_nodes"
        icon={<Icon2SVG file={TrackNodesSVGFile} altName="TrackNodes icon svg" />}
      />
    </div>
    <div className="col-md-6">
      <FormatTrackNode
        name="bufferstops"
        icon={<Icon2SVG file={BufferStopSVGFile} altName="Buffer stop svg" />}
      />
    </div>
    <div className="col-md-6">
      <FormatTrackNode
        name="detectors"
        icon={<Icon2SVG file={DetectorsSVGFile} altName="Detectors circles svg" />}
      />
    </div>
    <div className="col-md-6">
      <FormatTrackNode name="platforms" icon={<TbRectangleVerticalFilled />} />
    </div>
  </div>
);

export default MapSettingsLayers;
