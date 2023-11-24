import React from 'react';
import { cloneDeep } from 'lodash';
import { PSLExtension, PSLSign, SpeedSectionEntity, SpeedSectionPslEntity } from 'types';
import { useTranslation } from 'react-i18next';
import { PslSignInformation, PSL_SIGN_TYPES, RangeEditionState } from '../types';
import PslSignCard from './PslSignCard';
import PslSignSubSection from './PslSignSubSection';
import { msToKmh, selectPslSign } from '../utils';
import { PartialOrReducer } from '../../editorContextTypes';

const getNewAnnouncementSign = (
  trackRanges: NonNullable<SpeedSectionPslEntity['properties']['track_ranges']>,
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
    kp: '',
  } as PSLSign;
};

const getNewRSign = (
  trackRanges: NonNullable<SpeedSectionPslEntity['properties']['track_ranges']>
) => {
  const lastRange = trackRanges[trackRanges.length - 1];
  return {
    angle_geo: 0,
    angle_sch: 0,
    position: lastRange.end,
    side: 'LEFT',
    track: lastRange.track,
    type: 'R',
    value: '',
    kp: '',
  } as PSLSign;
};

const EditPSLSection = ({
  entity,
  setState,
}: {
  entity: SpeedSectionPslEntity;
  setState: (stateOrReducer: PartialOrReducer<RangeEditionState<SpeedSectionEntity>>) => void;
}) => {
  const { t } = useTranslation();
  const pslExtension = entity.properties.extensions.psl_sncf;

  const selectSign = (signInformation: PslSignInformation) => {
    selectPslSign(signInformation, setState);
  };

  const updateEntity = (newPslExtension: PSLExtension) => {
    const newEntity = cloneDeep(entity);
    newEntity.properties.extensions.psl_sncf = newPslExtension;
    setState({ entity: newEntity });
  };

  const addSign = (signType: PSL_SIGN_TYPES.ANNOUNCEMENT | PSL_SIGN_TYPES.R) => {
    const newPslExtension = cloneDeep(pslExtension);
    const trackRanges = entity.properties.track_ranges || [];
    if (signType === PSL_SIGN_TYPES.ANNOUNCEMENT) {
      const speedLimit = entity.properties.speed_limit || 30;
      newPslExtension.announcement = [
        ...pslExtension.announcement,
        getNewAnnouncementSign(trackRanges, speedLimit),
      ];
    } else {
      newPslExtension.r = [...pslExtension.r, getNewRSign(trackRanges)];
    }
    updateEntity(newPslExtension);
  };

  const updateSign = (signInfo: PslSignInformation, sign: PSLSign) => {
    const newPslExtension = cloneDeep(pslExtension);
    const { signType } = signInfo;
    if (signType === PSL_SIGN_TYPES.Z) {
      newPslExtension.z = sign;
    } else {
      const { signIndex } = signInfo;
      if (signType === PSL_SIGN_TYPES.ANNOUNCEMENT) {
        newPslExtension.announcement[signIndex] = sign;
      } else {
        newPslExtension.r[signIndex] = sign;
      }
    }
    updateEntity(newPslExtension);
  };

  const removeSign = ({
    signType,
    signIndex,
  }: Exclude<PslSignInformation, { signType: PSL_SIGN_TYPES.Z }>) => {
    const newPslExtension = cloneDeep(pslExtension);
    if (signType === PSL_SIGN_TYPES.ANNOUNCEMENT) {
      newPslExtension.announcement = newPslExtension.announcement.filter((_, i) => i !== signIndex);
    }
    if (signType === PSL_SIGN_TYPES.R) {
      newPslExtension.r = newPslExtension.r.filter((_, i) => i !== signIndex);
    }
    updateEntity(newPslExtension);
  };

  return (
    <div className="mt-3">
      <h3>{t('Editor.tools.speed-edition.signs-section-list')}</h3>
      <PslSignCard
        sign={pslExtension.z}
        signInfo={{ signType: PSL_SIGN_TYPES.Z }}
        t={t}
        updateSign={updateSign}
        selectSign={selectSign}
      />
      <PslSignSubSection
        signType={PSL_SIGN_TYPES.ANNOUNCEMENT}
        signs={pslExtension.announcement}
        t={t}
        updateSign={updateSign}
        addSign={addSign}
        removeSign={removeSign}
        selectSign={selectSign}
      />
      <PslSignSubSection
        signType={PSL_SIGN_TYPES.R}
        signs={pslExtension.r}
        updateSign={updateSign}
        addSign={addSign}
        removeSign={removeSign}
        selectSign={selectSign}
        t={t}
      />
    </div>
  );
};

export default EditPSLSection;
