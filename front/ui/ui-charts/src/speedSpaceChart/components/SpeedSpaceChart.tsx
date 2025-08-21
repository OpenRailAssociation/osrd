import React, { useCallback, useEffect, useMemo, useState } from 'react';

import InteractionButtons from './common/InteractionButtons';
import SettingsPanel from './common/SettingsPanel';
import { LINEAR_LAYERS_HEIGHTS, MARGINS } from './const';
import { resetZoom } from './helpers/layersManager';
import {
  AxisLayerY,
  CurveLayer,
  DeclivityLayer,
  ElectricalProfileLayer,
  FrontInteractivityLayer,
  PowerRestrictionsLayer,
  ReticleLayer,
  SpeedLimitsLayer,
  SpeedLimitTagsLayer,
  StepsLayer,
  TickLayerX,
  TickLayerYRight,
} from './layers/index';
import { getGraphOffsets } from './utils';
import type { Data, Store } from '../types';

export type SpeedSpaceChartProps = {
  width: number;
  height: number;
  backgroundColor: string;
  setHeight: React.Dispatch<React.SetStateAction<number>>;
  data: Data;
  translations?: {
    detailsBoxDisplay: {
      reticleInfos: string;
      energySource: string;
      tractionStatus: string;
      declivities: string;
      electricalProfiles: string;
      powerRestrictions: string;
    };
    layersDisplay: {
      context: string;
      steps: string;
      declivities: string;
      speedLimits: string;
      temporarySpeedLimits: string;
      electricalProfiles: string;
      powerRestrictions: string;
      speedLimitTags: string;
    };
  };
};

const SpeedSpaceChart = ({
  width,
  height,
  backgroundColor,
  data,
  setHeight,
  translations,
}: SpeedSpaceChartProps) => {
  const [store, setStore] = useState<Store>({
    speeds: [],
    ecoSpeeds: [],
    stops: [],
    electrifications: [],
    slopes: [],
    mrsp: undefined,
    powerRestrictions: undefined,
    electricalProfiles: undefined,
    speedLimitTags: undefined,
    trainLength: 0,
    ratioX: 1,
    leftOffset: 0,
    cursor: {
      x: null,
      y: null,
    },
    detailsBoxDisplay: {
      energySource: true,
      tractionStatus: true,
      declivities: true,
      electricalProfiles: true,
      powerRestrictions: true,
    },
    layersDisplay: {
      steps: true,
      declivities: false,
      speedLimits: false,
      electricalProfiles: false,
      powerRestrictions: false,
      speedLimitTags: false,
    },
    isSettingsPanelOpened: false,
  });

  const {
    mainChartHeight,
    powerRestrictionsTop,
    speedLimitTagsTop,
    electricalProfileLayerHeight,
    interactivityLayerHeight,
  } = useMemo(() => {
    const _electricalProfilesOffset = store.layersDisplay.electricalProfiles
      ? LINEAR_LAYERS_HEIGHTS.ELECTRICAL_PROFILES_HEIGHT
      : 0;
    const _powerRestrictionsOffset = store.layersDisplay.powerRestrictions
      ? LINEAR_LAYERS_HEIGHTS.POWER_RESTRICTIONS_HEIGHT
      : 0;
    const _speedLimitTagsOffset = store.layersDisplay.speedLimitTags
      ? LINEAR_LAYERS_HEIGHTS.SPEED_LIMIT_TAGS_HEIGHT
      : 0;

    // Height of the speedSpaceChart only (without the linear layers below) + top and bottom margins
    // TODO: remove the top and bottom margins from _mainChartHeight
    const _mainChartHeight =
      height - (_electricalProfilesOffset + _powerRestrictionsOffset + _speedLimitTagsOffset);

    const _baseLayerPosition = _mainChartHeight - MARGINS.MARGIN_BOTTOM;
    const _powerRestrictionsTop = _baseLayerPosition + _electricalProfilesOffset;
    const _speedLimitTagsTop = _powerRestrictionsTop + _powerRestrictionsOffset;

    const _interactivityLayerHeight =
      _mainChartHeight -
      MARGINS.MARGIN_BOTTOM -
      MARGINS.MARGIN_TOP +
      _electricalProfilesOffset +
      _powerRestrictionsOffset +
      _speedLimitTagsOffset;

    return {
      mainChartHeight: _mainChartHeight,
      powerRestrictionsTop: _powerRestrictionsTop,
      speedLimitTagsTop: _speedLimitTagsTop,
      electricalProfileLayerHeight:
        _mainChartHeight + LINEAR_LAYERS_HEIGHTS.ELECTRICAL_PROFILES_HEIGHT,
      interactivityLayerHeight: _interactivityLayerHeight,
    };
  }, [height, store.layersDisplay]);

  const { WIDTH_OFFSET, HEIGHT_OFFSET } = getGraphOffsets(
    width,
    mainChartHeight,
    store.layersDisplay.declivities
  );

  const { OFFSET_RIGHT_AXIS } = MARGINS;
  const adjustedWidthRightAxis = store.layersDisplay.declivities
    ? width - OFFSET_RIGHT_AXIS
    : width;

  const [isMouseHoveringSettingsPanel, setIsMouseHoveringSettingsPanel] = useState(false);

  const reset = () => {
    setStore((prev) => ({
      ...prev,
      ratioX: 1,
      leftOffset: 0,
    }));
    resetZoom();
  };

  const openSettingsPanel = () => {
    setStore((prev) => ({
      ...prev,
      isSettingsPanelOpened: true,
    }));
  };

  const adjustHeightOnLayerChange = useCallback(
    (
      layerName: 'electricalProfiles' | 'powerRestrictions' | 'speedLimitTags',
      isCurrentlyActive: boolean
    ) => {
      let adjustment: number;
      if (layerName === 'electricalProfiles') {
        adjustment = LINEAR_LAYERS_HEIGHTS.ELECTRICAL_PROFILES_HEIGHT;
      } else if (layerName === 'powerRestrictions') {
        adjustment = LINEAR_LAYERS_HEIGHTS.POWER_RESTRICTIONS_HEIGHT;
      } else {
        adjustment = LINEAR_LAYERS_HEIGHTS.SPEED_LIMIT_TAGS_HEIGHT;
      }
      setHeight((prevHeight) => prevHeight + (isCurrentlyActive ? -adjustment : adjustment));
    },
    [setHeight]
  );

  useEffect(() => {
    setStore((prev) => ({
      ...prev,
      ...data,
    }));
  }, [data]);

  return (
    <div
      style={{
        width: `${width}px`,
        height: `${height}px`,
        backgroundColor: `${backgroundColor}`,
      }}
      tabIndex={0}
    >
      <div
        className="flex justify-end absolute base-margin-top"
        style={{ width: adjustedWidthRightAxis }}
      >
        <InteractionButtons
          reset={reset}
          openSettingsPanel={openSettingsPanel}
          store={store}
          testIdPrefix="interaction"
        />
      </div>
      {store.isSettingsPanelOpened && (
        <div
          className="flex justify-end absolute ml-2 base-margin-top"
          style={{ width: adjustedWidthRightAxis }}
        >
          <SettingsPanel
            color={backgroundColor}
            store={store}
            setStore={setStore}
            setIsMouseHoveringSettingsPanel={setIsMouseHoveringSettingsPanel}
            translations={translations}
            testIdPrefix="settings-panel"
            adjustHeightOnLayerChange={adjustHeightOnLayerChange}
          />
        </div>
      )}
      {store.layersDisplay.declivities && (
        <DeclivityLayer width={WIDTH_OFFSET} height={HEIGHT_OFFSET} store={store} />
      )}
      <CurveLayer width={WIDTH_OFFSET} height={HEIGHT_OFFSET} store={store} />
      {store.layersDisplay.speedLimits && (
        <SpeedLimitsLayer width={adjustedWidthRightAxis} height={mainChartHeight} store={store} />
      )}
      {store.layersDisplay.steps && (
        <StepsLayer width={adjustedWidthRightAxis} height={mainChartHeight} store={store} />
      )}
      <AxisLayerY width={width} height={mainChartHeight} store={store} />
      {store.layersDisplay.electricalProfiles && (
        <ElectricalProfileLayer
          width={adjustedWidthRightAxis}
          height={electricalProfileLayerHeight}
          store={store}
        />
      )}
      {store.layersDisplay.powerRestrictions && (
        <PowerRestrictionsLayer
          width={adjustedWidthRightAxis}
          marginTop={powerRestrictionsTop}
          store={store}
        />
      )}
      {store.layersDisplay.speedLimitTags && (
        <SpeedLimitTagsLayer
          width={adjustedWidthRightAxis}
          marginTop={speedLimitTagsTop}
          store={store}
        />
      )}
      <TickLayerX width={adjustedWidthRightAxis} height={height} store={store} />
      {store.layersDisplay.declivities && (
        <TickLayerYRight width={width} height={mainChartHeight} store={store} />
      )}
      {!isMouseHoveringSettingsPanel && (
        <ReticleLayer
          width={adjustedWidthRightAxis}
          internalHeight={mainChartHeight}
          store={store}
        />
      )}
      <FrontInteractivityLayer
        width={WIDTH_OFFSET}
        height={interactivityLayerHeight}
        store={store}
        setStore={setStore}
      />
    </div>
  );
};

export default SpeedSpaceChart;
