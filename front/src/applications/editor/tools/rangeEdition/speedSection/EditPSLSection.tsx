import { useMemo } from 'react';

import { cloneDeep, compact } from 'lodash';
import { useTranslation } from 'react-i18next';

import type {
  PslSignInformation,
  RangeEditionState,
  TrackState,
  SpeedSectionPslEntity,
  PSLSign,
  SpeedSectionEntity,
  PSLExtension,
} from 'applications/editor/tools/rangeEdition/types';
import { PSL_SIGN_TYPES } from 'applications/editor/tools/rangeEdition/types';
import { selectPslSign } from 'applications/editor/tools/rangeEdition/utils';
import type { TrackSectionEntity } from 'applications/editor/tools/trackEdition/types';
import type { PartialOrReducer } from 'applications/editor/types';
import { removeDuplicates } from 'utils/array';
import { msToKmh } from 'utils/physics';

import PslSignCard from './PslSignCard';
import PslSignSubSection from './PslSignSubSection';

const getNewAnnouncementSign = (
  trackRanges: NonNullable<SpeedSectionPslEntity['properties']['track_ranges']>,
  speedLimit: number
) => {
  const firstRange = trackRanges[0];
  const speedInKmH = msToKmh(speedLimit);
  const speedMultipleOfFive = Math.ceil(speedInKmH / 5) * 5;
  return {
    direction: 'START_TO_STOP',
    position: firstRange.begin,
    side: 'LEFT',
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
    direction: 'START_TO_STOP',
    position: lastRange.end,
    side: 'LEFT',
    track: lastRange.track,
    type: 'R',
    value: '',
    kp: '',
  } as PSLSign;
};

const validateSignPosition = (sign: PSLSign, tracks: TrackSectionEntity[]) => {
  const validSign = cloneDeep(sign);
  const signTrack = tracks.find((track) => track.properties.id === sign.track);
  if (signTrack && sign.position > signTrack.properties.length) {
    return {
      ...validSign,
      position: signTrack.properties.length,
    };
  }
  if (sign.position < 0) {
    return {
      ...validSign,
      position: 0,
    };
  }
  return validSign;
};

const EditPSLSection = ({
  entity,
  trackSectionsCache,
  setState,
}: {
  entity: SpeedSectionPslEntity;
  trackSectionsCache: Record<string, TrackState>;
  setState: (stateOrReducer: PartialOrReducer<RangeEditionState<SpeedSectionEntity>>) => void;
}) => {
  const { t } = useTranslation();
  const pslExtension = entity.properties.extensions.psl_sncf;

  const tracks = useMemo(() => {
    const { psl_sncf: pslExtensionSigns } = entity.properties.extensions;
    const signs = [pslExtensionSigns.z, ...pslExtensionSigns.r, ...pslExtensionSigns.announcement];
    const signTrackIds = removeDuplicates(signs.map((sign) => sign.track));
    return compact(
      signTrackIds.map((trackId) => {
        const track = trackSectionsCache[trackId];
        return track?.type !== 'success' ? null : track.track;
      })
    );
  }, [entity.properties.extensions.psl_sncf]);

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
      const speedLimit = entity.properties.speed_limit || 30; // We should not have the value 30, 0 seems more accurate but we can't display it.
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
    const newSign = validateSignPosition(sign, tracks);

    const { signType } = signInfo;
    if (signType === PSL_SIGN_TYPES.Z) {
      newPslExtension.z = newSign;
    } else {
      const { signIndex } = signInfo;
      if (signType === PSL_SIGN_TYPES.ANNOUNCEMENT) {
        newPslExtension.announcement[signIndex] = newSign;
      } else {
        newPslExtension.r[signIndex] = newSign;
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
