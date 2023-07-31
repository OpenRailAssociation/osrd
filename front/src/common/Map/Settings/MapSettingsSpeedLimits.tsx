import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { updateLayersSettings } from 'reducers/map';
import { IoMdSpeedometer } from 'react-icons/io';
import SwitchSNCF, { SWITCH_TYPES } from 'common/BootstrapSNCF/SwitchSNCF/SwitchSNCF';
import SelectImprovedSNCF from 'common/BootstrapSNCF/SelectImprovedSNCF';
import DotsLoader from 'common/DotsLoader/DotsLoader';
import { setFailure } from 'reducers/main';
import TIVsSVGFile from 'assets/pictures/layersicons/layer_tivs.svg';
import { getInfraID } from 'reducers/osrdconf/selectors';
import { getMap } from 'reducers/map/selectors';
import { IconType } from 'react-icons';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { FormatSwitch as SimpleFormatSwitch, Icon2SVG } from './MapSettingsLayers';
import { ApiError } from 'common/api/emptyApi';
import { SerializedError } from '@reduxjs/toolkit';

type FormatSwitchProps = {
  name: string;
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

  const [speedLimitsTags, setSpeedLimitsTags] = useState<
    { key: string; value: string }[] | undefined
  >(undefined);

  const setLayerSettings = (setting: keyof typeof layersSettings) => {
    dispatch(
      updateLayersSettings({
        ...layersSettings,
        [setting]: !layersSettings[setting],
      })
    );
  };

  const dispatchSetSpeedLimitsTags = (item: { key: string; value: string }) => {
    dispatch(
      updateLayersSettings({
        ...layersSettings,
        speedlimittag: item.key,
      })
    );
  };

  const changeTagsListToObject = (tagsListArray: string[]) => {
    const tagsListObject = [{ key: t('noSpeedLimitByTag'), value: t('noSpeedLimitByTag') }].concat(
      tagsListArray.slice().map((tag) => ({ key: tag, value: tag }))
    );
    setSpeedLimitsTags(tagsListObject);
  };

  useEffect(() => {
    setSpeedLimitsTags(undefined);
    if (tagsList) changeTagsListToObject(tagsList);
  }, [infraID, tagsList]);

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
            onChange={() => setLayerSettings(name as keyof typeof layersSettings)}
            checked={!!layersSettings[name as keyof typeof layersSettings]}
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
            options={speedLimitsTags}
            onChange={dispatchSetSpeedLimitsTags}
            selectedValue={layersSettings.speedlimittag}
            sm
            withSearch
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
        <SimpleFormatSwitch name="sncf_lpv" icon={Icon2SVG(TIVsSVGFile, 'SNCF LPV TIV icon svg')} />
      </div>
    </div>
  );
}
