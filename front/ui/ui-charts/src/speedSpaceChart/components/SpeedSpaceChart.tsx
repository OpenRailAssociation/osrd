import React, { useEffect, useState } from 'react';

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
import { getAdaptiveHeight, getGraphOffsets, getLinearLayerMarginTop } from './utils';
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

  const { WIDTH_OFFSET, HEIGHT_OFFSET } = getGraphOffsets(
    width,
    height,
    store.layersDisplay.declivities
  );
  const dynamicHeight = getAdaptiveHeight(height, store.layersDisplay);
  const dynamicHeightOffset = getAdaptiveHeight(HEIGHT_OFFSET, store.layersDisplay);
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

  useEffect(() => {
    setStore((prev) => ({
      ...prev,
      ...data,
    }));
  }, [data]);

  useEffect(() => {
    setHeight(dynamicHeight);
  }, [setHeight, dynamicHeight]);

  return (
    <div
      style={{
        width: `${width}px`,
        height: `${dynamicHeight}px`,
        backgroundColor: `${backgroundColor}`,
      }}
      tabIndex={0}
    >
      <div
        className="flex justify-end absolute base-margin-top"
        style={{ width: adjustedWidthRightAxis }}
      >
        <InteractionButtons reset={reset} openSettingsPanel={openSettingsPanel} store={store} />
      </div>
      {store.isSettingsPanelOpened && (
        <div
          className="flex justify-end absolute ml-2 base-margin-top"
          style={{ width: adjustedWidthRightAxis }}
        >
          <SettingsPanel
            globalHeight={dynamicHeight}
            color={backgroundColor}
            store={store}
            setStore={setStore}
            setIsMouseHoveringSettingsPanel={setIsMouseHoveringSettingsPanel}
            translations={translations}
          />
        </div>
      )}
      {store.layersDisplay.declivities && (
        <DeclivityLayer width={WIDTH_OFFSET} height={HEIGHT_OFFSET} store={store} />
      )}
      <CurveLayer width={WIDTH_OFFSET} height={HEIGHT_OFFSET} store={store} />
      {store.layersDisplay.speedLimits && (
        <SpeedLimitsLayer width={adjustedWidthRightAxis} height={height} store={store} />
      )}
      {store.layersDisplay.steps && (
        <StepsLayer width={adjustedWidthRightAxis} height={height} store={store} />
      )}
      <AxisLayerY width={width} height={height} store={store} />
      {store.layersDisplay.electricalProfiles && (
        <ElectricalProfileLayer
          width={adjustedWidthRightAxis}
          height={height + LINEAR_LAYERS_HEIGHTS.ELECTRICAL_PROFILES_HEIGHT}
          store={store}
        />
      )}
      {store.layersDisplay.powerRestrictions && (
        <PowerRestrictionsLayer
          width={adjustedWidthRightAxis}
          marginTop={getLinearLayerMarginTop(height, store.layersDisplay)}
          store={store}
        />
      )}
      {store.layersDisplay.speedLimitTags && (
        <SpeedLimitTagsLayer
          width={adjustedWidthRightAxis}
          marginTop={getLinearLayerMarginTop(
            height,
            store.layersDisplay,
            store.layersDisplay.speedLimitTags
          )}
          store={store}
        />
      )}
      <TickLayerX width={adjustedWidthRightAxis} height={dynamicHeight} store={store} />
      {store.layersDisplay.declivities && (
        <TickLayerYRight width={width} height={height} store={store} />
      )}
      {!isMouseHoveringSettingsPanel && (
        <ReticleLayer
          width={adjustedWidthRightAxis}
          height={dynamicHeight}
          heightOffset={dynamicHeightOffset}
          store={store}
        />
      )}
      <FrontInteractivityLayer
        width={WIDTH_OFFSET}
        height={dynamicHeightOffset}
        store={store}
        setStore={setStore}
      />
    </div>
  );
};

export default SpeedSpaceChart;
