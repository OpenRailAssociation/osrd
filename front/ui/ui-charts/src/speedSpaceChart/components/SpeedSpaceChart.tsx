import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { Slider } from '@osrd-project/ui-core';

import type { Data, EtcsBrakingCurves, Store } from '../types';
import InteractionButtons from './common/InteractionButtons';
import SettingsPanel from './common/SettingsPanel';
import { DEFAULT_ETCS_LAYERS_DISPLAY, LINEAR_LAYERS_HEIGHTS, MARGINS, ZOOM_CONFIG } from './const';
import { computeLeftOffsetOnZoom, resetZoom } from './helpers/layersManager';
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
import { clamp, getActiveEtcsBrakingTypes, getGraphOffsets } from './utils';

export type SpeedSpaceChartProps = {
  width: number;
  height: number;
  backgroundColor: string;
  setHeight: React.Dispatch<React.SetStateAction<number>>;
  fetchEtcsBrakingCurves?: () => Promise<void>;
  etcsBrakingCurves?: EtcsBrakingCurves;
  data: Data;
  translations?: {
    detailsBoxDisplay: {
      reticleInfos: string;
      energySource: string;
      tractionStatus: string;
      declivities: string;
      etcs: string;
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
    etcsLayersDisplay: {
      title: string;
      etcsBrakingTypes: {
        stopsAndTransitions: string;
        signals: string;
        spacing: string;
        routing: string;
      };
      etcsBrakingCurveTypes: {
        indication: string;
        permittedSpeed: string;
        guidance: string;
      };
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
  fetchEtcsBrakingCurves,
  etcsBrakingCurves,
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
      etcs: false,
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
    etcsLayersDisplay: DEFAULT_ETCS_LAYERS_DISPLAY,
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
    const shouldFetchEtcsCurves = getActiveEtcsBrakingTypes(store.etcsLayersDisplay).length > 0;
    if (fetchEtcsBrakingCurves && shouldFetchEtcsCurves) {
      fetchEtcsBrakingCurves();
    }
  }, [fetchEtcsBrakingCurves, store.etcsLayersDisplay]);

  useEffect(() => {
    setStore((prev) => ({
      ...prev,
      etcsBrakingCurves: etcsBrakingCurves,
    }));
  }, [etcsBrakingCurves]);

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
        position: 'relative',
      }}
      tabIndex={0}
    >
      <div className="speed-space-slider-container">
        <Slider
          className="speed-space-slider"
          width={ZOOM_CONFIG.SLIDER_WIDTH}
          min={Math.log(ZOOM_CONFIG.MIN_RATIO) / Math.log(1.1)}
          max={Math.log(ZOOM_CONFIG.MAX_RATIO) / Math.log(1.1)}
          value={Math.log(store.ratioX) / Math.log(1.1)}
          onChange={(e) => {
            const value = clamp(
              Math.pow(1.1, Number(e.target.value)),
              ZOOM_CONFIG.MIN_RATIO,
              ZOOM_CONFIG.MAX_RATIO
            );
            setStore((prev) => ({
              ...prev,
              ratioX: value,
              leftOffset: computeLeftOffsetOnZoom(value),
            }));
          }}
        />
      </div>
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
            displayEtcs={fetchEtcsBrakingCurves !== undefined}
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
