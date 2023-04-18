/* eslint-disable no-restricted-syntax */
import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { updatePowerRestriction } from 'reducers/osrdconf';
import icon from 'assets/pictures/components/power_restrictions.svg';
import SelectImprovedSNCF from 'common/BootstrapSNCF/SelectImprovedSNCF';
import {
  getRollingStockID,
  getPowerRestriction,
  getPathfindingID,
} from 'reducers/osrdconf/selectors';
import { osrdEditoastApi, LightRollingStock } from 'common/api/osrdEditoastApi';
import { osrdMiddlewareApi, PowerRestrictionRange } from 'common/api/osrdMiddlewareApi';
import { lengthFromLineCoordinates } from 'utils/geometry';
import { setFailure } from 'reducers/main';

type selectorOption = { key: string | undefined; value: string | undefined };

type ElectrificationPR = {
  [key: string]: string[] | (string | null | undefined)[];
};

export default function PowerRestrictionSelector() {
  const { t } = useTranslation(['operationalStudies/manageTrainSchedule']);
  const dispatch = useDispatch();
  const rollingStockID: number | undefined = useSelector(getRollingStockID);
  const pathFindingID = useSelector(getPathfindingID);
  const powerRestriction = useSelector(getPowerRestriction);
  const [powerRestrictions, setPowerRestrictions] = useState<selectorOption[] | undefined>();
  const [getRollingStockById] = osrdEditoastApi.endpoints.getLightRollingStockById.useLazyQuery({});
  const [getPathFindingById] = osrdMiddlewareApi.endpoints.getPathfindingById.useLazyQuery({});
  const [getPathFindingByIdCatenaries] =
    osrdEditoastApi.useLazyGetPathfindingByPathIdCatenariesQuery();
  const [getRollingStockWithCurves] = osrdEditoastApi.useLazyGetRollingStockByIdQuery();

  const getPowerRestrictionsList = async (rollingStockInfo: LightRollingStock) => {
    if (rollingStockInfo.power_restrictions) {
      const powerRestrictionsList = Object.entries(rollingStockInfo.power_restrictions).map(
        ([key, _]: [string | undefined, string]) => ({ key, value: key })
      );
      if (powerRestrictionsList.length > 0) {
        powerRestrictionsList.unshift({ key: undefined, value: t('noPowerRestriction') });
      }
      setPowerRestrictions(powerRestrictionsList);
    }
  };

  const definePowerRestrictionRange = async (powerRestrictionCode?: string) => {
    if (powerRestrictionCode && pathFindingID && rollingStockID) {
      const { data: pathWithCatenaries } = await getPathFindingByIdCatenaries({
        pathId: pathFindingID,
      });
      const { data: rollingStockWithCurves } = await getRollingStockWithCurves({
        id: rollingStockID,
      });

      if (rollingStockWithCurves && pathWithCatenaries) {
        // Extract uniques rollingstock's power restriction codes allowed by each electrification mode
        const curvesMode = rollingStockWithCurves?.effort_curves.modes;
        const curvesModesKey = Object.keys(curvesMode);

        let parsedElectrification: ElectrificationPR = {};
        for (const mode of curvesModesKey) {
          let powerCodes = curvesMode[mode].curves.map(
            (curve) => curve.cond?.power_restriction_code
          );
          powerCodes = powerCodes.filter(
            (value, index, array) => value && array.indexOf(value) === index
          );
          parsedElectrification = {
            ...parsedElectrification,
            [mode]: powerCodes,
          };
        }

        // Extract path electrification mode and check compatibility
        const pathCatenaryRanges = pathWithCatenaries.catenary_ranges;
        if (pathCatenaryRanges) {
          const pathElectrification = pathCatenaryRanges.map((range) => range.mode);

          const isCombinationValid = pathElectrification.every(
            (electrification) =>
              electrification &&
              parsedElectrification[electrification as keyof ElectrificationPR].includes(
                powerRestrictionCode
              )
          );
          if (!isCombinationValid) {
            dispatch(
              setFailure({
                name: t('errorMessages.error'),
                message: t('errorMessages.powerRestrictionInvalidCombination', {
                  powerRestrictionCode,
                }),
              })
            );
            dispatch(updatePowerRestriction(undefined));
          } else {
            getPathFindingById({ id: pathFindingID })
              .unwrap()
              .then((pathFinding) => {
                const pathLength = Math.round(
                  lengthFromLineCoordinates(pathFinding?.geographic?.coordinates) * 1000
                );
                const powerRestrictionRange: PowerRestrictionRange[] = [
                  {
                    begin_position: 0,
                    end_position: pathLength,
                    power_restriction_code: powerRestrictionCode,
                  },
                ];
                dispatch(updatePowerRestriction(powerRestrictionRange));
              });
          }
        }
      }
    } else dispatch(updatePowerRestriction(undefined));
  };

  useEffect(() => {
    if (rollingStockID) {
      dispatch(updatePowerRestriction(undefined));
      setPowerRestrictions(undefined);
      getRollingStockById({ id: rollingStockID })
        .unwrap()
        .then((rollingStockInfo) => {
          getPowerRestrictionsList(rollingStockInfo);
        });
    }
  }, [rollingStockID]);

  return powerRestrictions && powerRestrictions.length > 0 && pathFindingID ? (
    <div className="osrd-config-item mb-2">
      <div className="osrd-config-item-container">
        <img width="32px" className="mr-2" src={icon} alt="PowerRestrictionIcon" />
        <span className="text-muted">{t('powerRestriction')}</span>
        <SelectImprovedSNCF
          sm
          options={powerRestrictions}
          onChange={(e: selectorOption) => definePowerRestrictionRange(e.key)}
          selectedValue={powerRestriction?.power_restriction_code || t('noPowerRestriction')}
        />
      </div>
    </div>
  ) : null;
}
