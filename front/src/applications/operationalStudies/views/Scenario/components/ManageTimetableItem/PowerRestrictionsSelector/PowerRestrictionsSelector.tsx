import { Alert } from '@osrd-project/ui-icons';
import { isEmpty } from 'lodash';
import { useTranslation } from 'react-i18next';

import type { ManageTimetableItemPathProperties } from 'applications/operationalStudies/types';
import icon from 'assets/pictures/components/power_restrictions.svg';
import type { RollingStock } from 'common/api/osrdEditoastApi';
import IntervalsEditor from 'common/IntervalsEditor';
import { INTERVAL_TYPES } from 'common/IntervalsEditor/types';
import type { RangedValue } from 'common/types';
import { NO_POWER_RESTRICTION } from 'modules/powerRestriction/consts';
import { mmToM } from 'utils/physics';

import usePowerRestrictionsSelector from './hooks/usePowerRestrictionsSelector';

type PowerRestrictionsSelectorProps = {
  voltageRanges: RangedValue[];
  rollingStockModes: RollingStock['effort_curves']['modes'];
  rollingStockPowerRestrictions: RollingStock['power_restrictions'];
  pathProperties: ManageTimetableItemPathProperties;
};

const PowerRestrictionsSelector = ({
  voltageRanges,
  rollingStockModes,
  rollingStockPowerRestrictions,
  pathProperties,
}: PowerRestrictionsSelectorProps) => {
  const { t } = useTranslation('operational-studies', { keyPrefix: 'manageTimetableItem' });

  const {
    ranges,
    compatibleVoltageRanges,
    electrificationChangePoints,
    pathLength, // in meters
    powerRestrictionOptions,
    warnings,
    warningsNb,
    resizeSegments,
    mergePowerRestrictionRange,
    deletePowerRestrictionRange,
    cutPowerRestrictionRange,
    editPowerRestrictionRanges,
  } = usePowerRestrictionsSelector(
    voltageRanges,
    rollingStockPowerRestrictions,
    rollingStockModes,
    pathProperties
  );

  return (
    <div className="osrd-config-item mb-2">
      <div className="osrd-config-item-container text-muted">
        <img width="32px" className="mr-2" src={icon} alt="PowerRestrictionIcon" />
        <span>{t('powerRestriction')}</span>
        {!isEmpty(rollingStockPowerRestrictions) ? (
          <>
            <p className="mb-1 mt-1">{t('powerRestrictionExplanationText')}</p>
            {warningsNb > 0 && (
              <div className="border border-warning rounded p-3 my-3">
                <div className="d-flex align-items-center mb-2">
                  <div className="d-flex align-items-center text-warning">
                    <Alert />
                  </div>
                  <span className="ml-2">
                    {t('warningMessages.inconsistent', { count: warningsNb })}
                  </span>
                </div>
                <div className="d-flex flex-column">
                  {warnings &&
                    warnings.modeNotSupportedWarnings.map(({ begin, end, electrification }) => (
                      <span key={`not-handled-mode-${begin}-${end}`}>
                        {t('warningMessages.modeNotHandled', {
                          begin: mmToM(begin),
                          end: mmToM(end),
                          electrification,
                        })}
                      </span>
                    ))}

                  {warnings &&
                    Object.values(warnings.invalidCombinationWarnings).map(
                      ({ powerRestrictionCode, electrification, begin, end }) => (
                        <span key={`${powerRestrictionCode}-${begin}-${end}`}>
                          {t('warningMessages.powerRestrictionInvalidCombination', {
                            powerRestrictionCode,
                            electrification,
                            begin: mmToM(begin),
                            end: mmToM(end),
                          })}
                        </span>
                      )
                    )}
                  {warnings &&
                    warnings.missingPowerRestrictionWarnings.map(({ begin, end }) => (
                      <span key={`missing-power-restriction-${begin}-${end}`}>
                        {t('warningMessages.missingPowerRestriction', {
                          begin: mmToM(begin),
                          end: mmToM(end),
                        })}
                      </span>
                    ))}
                </div>
              </div>
            )}
            <IntervalsEditor
              additionalData={compatibleVoltageRanges}
              intervalType={INTERVAL_TYPES.SELECT}
              data={ranges}
              defaultValue={NO_POWER_RESTRICTION}
              emptyValue={NO_POWER_RESTRICTION}
              operationalPoints={electrificationChangePoints}
              selectOptions={powerRestrictionOptions}
              setData={editPowerRestrictionRanges}
              onCut={cutPowerRestrictionRange}
              onDelete={deletePowerRestrictionRange}
              onMerge={mergePowerRestrictionRange}
              totalLength={pathLength}
              toolsConfig={{
                cutTool: true,
                deleteTool: true,
                mergeTool: true,
              }}
              disableDrag
              onResizeFromInput={resizeSegments}
            />
          </>
        ) : (
          <p className="pt-1">{t('powerRestrictionEmptyExplanationText')}</p>
        )}
      </div>
    </div>
  );
};

export default PowerRestrictionsSelector;
