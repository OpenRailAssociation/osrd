import React, { useEffect, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { IoMdSpeedometer } from 'react-icons/io';
import type { IconType } from 'react-icons';
import type { SerializedError } from '@reduxjs/toolkit';

import TIVsSVGFile from 'assets/pictures/layersicons/layer_tivs.svg';

import DotsLoader from 'common/DotsLoader/DotsLoader';
import { useInfraID } from 'common/osrdContext';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import type { ApiError } from 'common/api/baseGeneratedApis';
import SelectImprovedSNCF from 'common/BootstrapSNCF/SelectImprovedSNCF';
import SwitchSNCF, { SWITCH_TYPES } from 'common/BootstrapSNCF/SwitchSNCF/SwitchSNCF';
import {
  FormatSwitch as SimpleFormatSwitch,
  Icon2SVG,
} from 'common/Map/Settings/MapSettingsLayers';

import { setFailure } from 'reducers/main';
import { getMap } from 'reducers/map/selectors';
import { updateLayersSettings } from 'reducers/map';
import type { MapState } from 'reducers/map';

type FormatSwitchProps = {
  name: keyof MapState['layersSettings'];
  icon: IconType;
  color?: string;
  disabled?: boolean;
};

const FormatSwitch = ({ name, icon: IconComponent, color = '', disabled }: FormatSwitchProps) => {
  const dispatch = useDispatch();
  const { t } = useTranslation(['operationalStudies/manageTrainSchedule', 'map-settings']);
  const { layersSettings } = useSelector(getMap);
  const infraID = useInfraID();
  const {
    data: tagsList,
    isError: isGetSpeedLimitTagsError,
    error: getSpeedLimitTagsError,
  } = osrdEditoastApi.useGetInfraByIdSpeedLimitTagsQuery(
    { id: infraID as number },
    {
      skip: !infraID,
    }
  );

  const DEFAULT_SPEED_LIMIT_TAG = useMemo(() => t('map-settings:noSpeedLimitByTag'), [t]);

  const setLayerSettings = (setting: keyof MapState['layersSettings']) => {
    dispatch(
      updateLayersSettings({
        ...layersSettings,
        [setting]: !layersSettings[setting],
      })
    );
  };

  const dispatchSetSpeedLimitsTags = (item: string) => {
    const newTag = item !== DEFAULT_SPEED_LIMIT_TAG ? item : null;
    dispatch(
      updateLayersSettings({
        ...layersSettings,
        speedlimittag: newTag,
      })
    );
  };

  const speedLimitsTags = useMemo(
    () => (tagsList ? [DEFAULT_SPEED_LIMIT_TAG, ...tagsList] : undefined),
    [tagsList]
  );

  useEffect(() => {
    if (isGetSpeedLimitTagsError && getSpeedLimitTagsError) {
      dispatch(
        setFailure({
          name: t('errorMessages.unableToRetrieveTags'),
          message:
            `${(getSpeedLimitTagsError as ApiError).data.message}` ||
            `${(getSpeedLimitTagsError as SerializedError).message}}`,
        })
      );
    }
  }, [isGetSpeedLimitTagsError]);

  return (
    <>
      <div className="col-lg-6">
        <div className="d-flex align-items-center mt-2">
          <SwitchSNCF
            id={`${name}-switch`}
            type={SWITCH_TYPES.switch}
            name={`${name}-switch`}
            onChange={() => setLayerSettings(name)}
            checked={!!layersSettings[name]}
            disabled={disabled}
          />
          <span className={`px-1 d-flex align-items-center ${color}`}>
            <IconComponent />
          </span>
          <small>{t(`map-settings:${name}`)}</small>
        </div>
      </div>
      <div className="col-lg-6 pt-1">
        {speedLimitsTags ? (
          <SelectImprovedSNCF
            sm
            withSearch
            value={layersSettings.speedlimittag || DEFAULT_SPEED_LIMIT_TAG}
            options={speedLimitsTags}
            onChange={dispatchSetSpeedLimitsTags}
          />
        ) : (
          <span className="ml-3">
            <DotsLoader />
          </span>
        )}
      </div>
    </>
  );
};

export default function MapSettingsLayers() {
  return (
    <div className="row">
      <FormatSwitch name="speedlimits" icon={IoMdSpeedometer} />
      <div className="col-lg-6">
        <SimpleFormatSwitch
          name="sncf_psl"
          icon={<Icon2SVG file={TIVsSVGFile} altName="SNCF PSL TIV icon svg" />}
        />
      </div>
    </div>
  );
}
