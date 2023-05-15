import React from 'react';
import { cloneDeep } from 'lodash';
import { LPVExtension, LPVPanel, SpeedSectionEntity, SpeedSectionLpvEntity } from 'types';
import { useTranslation } from 'react-i18next';
import { LpvPanelInformation, LPV_PANEL_TYPES, RangeEditionState } from '../types';
import LpvPanelCard from './LpvPanelCard';
import LpvPanelSubSection from './LpvPanelSubSection';
import { msToKmh, selectLpvPanel } from '../utils';
import { PartialOrReducer } from '../../editorContextTypes';

const getNewAnnouncementPanel = (
  trackRanges: NonNullable<SpeedSectionLpvEntity['properties']['track_ranges']>,
  speedLimit: number
) => {
  const firstRange = trackRanges[0];
  const speedInKmH = msToKmh(speedLimit);
  const speedMultipleOfFive = Math.ceil(speedInKmH / 5) * 5;
  return {
    angle_geo: 0,
    angle_sch: 0,
    position: firstRange.end,
    side: 'RIGHT',
    track: firstRange.track,
    type: 'TIV_D',
    value: `${speedMultipleOfFive}`,
  } as LPVPanel;
};

const getNewRPanel = (
  trackRanges: NonNullable<SpeedSectionLpvEntity['properties']['track_ranges']>
) => {
  const lastRange = trackRanges[trackRanges.length - 1];
  return {
    angle_geo: 0,
    angle_sch: 0,
    position: lastRange.end,
    side: 'LEFT',
    track: lastRange.track,
    type: 'R',
    value: null,
  } as LPVPanel;
};

const EditLPVSection = ({
  entity,
  setState,
}: {
  entity: SpeedSectionLpvEntity;
  setState: (stateOrReducer: PartialOrReducer<RangeEditionState<SpeedSectionEntity>>) => void;
}) => {
  const { t } = useTranslation();
  const lpvExtension = entity.properties.extensions.lpv_sncf;

  const selectPanel = (panelInformation: LpvPanelInformation) => {
    selectLpvPanel(panelInformation, setState);
  };

  const updateEntity = (newLpvExtension: LPVExtension) => {
    const newEntity = cloneDeep(entity);
    newEntity.properties.extensions.lpv_sncf = newLpvExtension;
    setState({ entity: newEntity });
  };

  const addPanel = (panelType: LPV_PANEL_TYPES.ANNOUNCEMENT | LPV_PANEL_TYPES.R) => {
    const newLpvExtension = cloneDeep(lpvExtension);
    const trackRanges = entity.properties.track_ranges || [];
    if (panelType === LPV_PANEL_TYPES.ANNOUNCEMENT) {
      const speedLimit = entity.properties.speed_limit || 30;
      newLpvExtension.announcement = [
        ...lpvExtension.announcement,
        getNewAnnouncementPanel(trackRanges, speedLimit),
      ];
    } else {
      newLpvExtension.r = [...lpvExtension.r, getNewRPanel(trackRanges)];
    }
    updateEntity(newLpvExtension);
  };

  const updatePanel = (panelInfo: LpvPanelInformation, panel: LPVPanel) => {
    const newLpvExtension = cloneDeep(lpvExtension);
    const { panelType } = panelInfo;
    if (panelType === LPV_PANEL_TYPES.Z) {
      newLpvExtension.z = panel;
    } else {
      const { panelIndex } = panelInfo;
      if (panelType === LPV_PANEL_TYPES.ANNOUNCEMENT) {
        newLpvExtension.announcement[panelIndex] = panel;
      } else {
        newLpvExtension.r[panelIndex] = panel;
      }
    }
    updateEntity(newLpvExtension);
  };

  const removePanel = ({
    panelType,
    panelIndex,
  }: Exclude<LpvPanelInformation, { panelType: LPV_PANEL_TYPES.Z }>) => {
    const newLpvExtension = cloneDeep(lpvExtension);
    if (panelType === LPV_PANEL_TYPES.ANNOUNCEMENT) {
      newLpvExtension.announcement = newLpvExtension.announcement.filter(
        (_, i) => i !== panelIndex
      );
    }
    if (panelType === LPV_PANEL_TYPES.R) {
      newLpvExtension.r = newLpvExtension.r.filter((_, i) => i !== panelIndex);
    }
    updateEntity(newLpvExtension);
  };

  return (
    <div className="mt-3">
      <h3>{t('Editor.tools.speed-edition.panels-section-list')}</h3>
      <LpvPanelCard
        panel={lpvExtension.z}
        panelInfo={{ panelType: LPV_PANEL_TYPES.Z }}
        t={t}
        updatePanel={updatePanel}
        selectPanel={selectPanel}
      />
      <LpvPanelSubSection
        panelType={LPV_PANEL_TYPES.ANNOUNCEMENT}
        panels={lpvExtension.announcement}
        t={t}
        updatePanel={updatePanel}
        addPanel={addPanel}
        removePanel={removePanel}
        selectPanel={selectPanel}
      />
      <LpvPanelSubSection
        panelType={LPV_PANEL_TYPES.R}
        panels={lpvExtension.r}
        updatePanel={updatePanel}
        addPanel={addPanel}
        removePanel={removePanel}
        selectPanel={selectPanel}
        t={t}
      />
    </div>
  );
};

export default EditLPVSection;
