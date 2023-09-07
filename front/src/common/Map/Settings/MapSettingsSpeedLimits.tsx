import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { MapState, updateLayersSettings } from 'reducers/map';
import { IoMdSpeedometer } from 'react-icons/io';
import { IconType } from 'react-icons';
import { SerializedError } from '@reduxjs/toolkit';

import TIVsSVGFile from 'assets/pictures/layersicons/layer_tivs.svg';
import SwitchSNCF, { SWITCH_TYPES } from 'common/BootstrapSNCF/SwitchSNCF/SwitchSNCF';
import SelectImprovedSNCF from 'common/BootstrapSNCF/SelectImprovedSNCF';
import DotsLoader from 'common/DotsLoader/DotsLoader';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { ApiError } from 'common/api/emptyApi';
import { setFailure } from 'reducers/main';
import { getInfraID } from 'reducers/osrdconf/selectors';
import { getMap } from 'reducers/map/selectors';
import { FormatSwitch as SimpleFormatSwitch, Icon2SVG } from './MapSettingsLayers';

type FormatSwitchProps = {
  name: keyof MapState['layersSettings'];
  icon: IconType;
  color?: string;
  disabled?: boolean;
};

const FormatSwitch = ({ name, icon: IconComponent, color = '', disabled }: FormatSwitchProps) => {
  const dispatch = useDispatch();
  const { t } = useTranslation(['map-settings']);
  const { layersSettings } = useSelector(getMap);
  const infraID = useSelector(getInfraID);
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

  const [speedLimitsTags, setSpeedLimitsTags] = useState<string[] | undefined>(undefined);

  const setLayerSettings = (setting: keyof MapState['layersSettings']) => {
    dispatch(
      updateLayersSettings({
        ...layersSettings,
        [setting]: !layersSettings[setting],
      })
    );
  };

  const dispatchSetSpeedLimitsTags = (item?: string) => {
    if (item)
      dispatch(
        updateLayersSettings({
          ...layersSettings,
          speedlimittag: item,
        })
      );
  };

  useEffect(() => {
    if (tagsList) setSpeedLimitsTags([t('noSpeedLimitByTag').toString(), ...tagsList]);
    else setSpeedLimitsTags(undefined);
  }, [tagsList]);

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
          <small>{t(name)}</small>
        </div>
      </div>
      <div className="col-lg-6 pt-1">
        {speedLimitsTags ? (
          <SelectImprovedSNCF
            sm
            withSearch
            value={layersSettings.speedlimittag}
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
          name="sncf_lpv"
          icon={<Icon2SVG file={TIVsSVGFile} altName="SNCF LPV TIV icon svg" />}
        />
      </div>
    </div>
  );
}
