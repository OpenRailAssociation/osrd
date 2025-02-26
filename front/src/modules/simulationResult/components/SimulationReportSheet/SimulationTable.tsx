/* eslint-disable no-nested-ternary */
import { Table, TR, TH, TD } from '@ag-media/react-pdf-table';
import { View } from '@react-pdf/renderer';
import { useTranslation } from 'react-i18next';

import type { OperationalPointWithTimeAndSpeed } from 'applications/operationalStudies/types';
import type { StdcmResultsOperationalPoint, StdcmSuccessResponse } from 'applications/stdcm/types';
import { getStopDurationTime } from 'applications/stdcm/utils/formatSimulationReportSheet';
import type { PathfindingResultSuccess } from 'common/api/osrdEditoastApi';
import { Duration } from 'utils/duration';
import { capitalizeFirstLetter } from 'utils/strings';
import { secToHoursString } from 'utils/timeManipulation';

import { getSecondaryCode } from './helpers';
import styles from './style/SimulationReportStyleSheet';
import type { SimulationSheetData } from '../SimulationResultExport/types';

interface SimulationTableProps {
  stdcmData?: StdcmSuccessResponse;
  trainData?: SimulationSheetData;
  operationalPointsList: (OperationalPointWithTimeAndSpeed | StdcmResultsOperationalPoint)[];
  path?: PathfindingResultSuccess;
  consistMass?: number;
  consistLength?: number;
}

const SimulationTable = ({
  stdcmData,
  trainData,
  operationalPointsList,
  path,
  consistMass,
  consistLength,
}: SimulationTableProps) => {
  const { t } = useTranslation(['stdcm-simulation-report-sheet', 'stdcm']);
  const rollingStock = stdcmData?.rollingStock || trainData?.rollingStock;

  return (
    <View style={styles.simulation.tableContainer}>
      <Table style={styles.simulation.table}>
        <TH style={styles.simulation.th}>
          <View style={styles.simulation.indexWidth}>
            <TD aria-label="line-count" />
          </View>
          <View style={styles.simulation.opWidth}>
            <TD>{t('operationalPoint')}</TD>
          </View>
          <View style={styles.simulation.chWidth}>
            <TD>{t('code')}</TD>
          </View>
          <View style={styles.simulation.trackWidth}>
            <TD>{t('track')}</TD>
          </View>
          <View style={styles.simulation.endWidth}>
            <TD>{t('endStop')}</TD>
          </View>
          <View style={styles.simulation.passageWidth}>
            <TD>{t('passageStop')}</TD>
          </View>
          <View style={styles.simulation.startWidth}>
            <TD>{t('startStop')}</TD>
          </View>
          <View style={styles.simulation.weightWidth}>
            <TD>{t('weight')}</TD>
          </View>
          {consistLength !== undefined && (
            <View style={styles.simulation.length}>
              <TD>{t('length')}</TD>
            </View>
          )}
          <View style={styles.simulation.refEngineWidth}>
            <TD>{t('referenceEngine')}</TD>
          </View>
          <View style={styles.simulation.stopType}>
            <TD>{t('simulationStopType')}</TD>
          </View>
        </TH>
        {operationalPointsList.map((step, index) => {
          const isFirstStep = index === 0;
          const isLastStep = index === operationalPointsList.length - 1;
          const prevStep = operationalPointsList[index - 1];
          const isViaInSimulationPath = stdcmData?.simulationPathSteps
            .slice(1, -1)
            .some(
              (s) => s.location && s.location.name === step.name && getSecondaryCode(s) === step.ch
            );
          const isWaypoint = path?.path_item_positions
            .slice(1, -1)
            .some((pos) => 'position' in step && pos / 1000 === step.position);
          const isViaWithoutStop = (isViaInSimulationPath || isWaypoint) && step.duration === 0;
          const isNotExtremity = !isFirstStep && !isLastStep;
          const isStepWithDuration = step.duration !== 0 && !isLastStep;
          const tdPassageStopStyle = !isViaWithoutStop
            ? styles.simulation.td
            : { ...styles.simulation.td, paddingLeft: '' };
          const trackName = 'track_name' in step ? step.track_name : '-';

          return (
            <TR
              key={index}
              style={isStepWithDuration ? styles.simulation.blueRow : styles.simulation.tbody}
            >
              <TD
                style={
                  isViaWithoutStop
                    ? styles.simulation.indexColumnPassageStop
                    : styles.simulation.indexColumn
                }
              >
                {index + 1}
              </TD>
              <View style={styles.simulation.opWidth}>
                <TD
                  style={
                    isViaWithoutStop
                      ? styles.simulation.opColumnPassageStop
                      : isNotExtremity && step.duration !== 0
                        ? styles.simulation.opStop
                        : styles.simulation.td
                  }
                >
                  {isNotExtremity &&
                  !isWaypoint &&
                  !isViaInSimulationPath &&
                  step.name === prevStep.name
                    ? '='
                    : step.name || 'Unknown'}
                </TD>
              </View>
              <View style={styles.simulation.chWidth}>
                <TD style={tdPassageStopStyle}>{step.ch}</TD>
              </View>
              <View style={styles.simulation.trackWidth}>
                <TD style={tdPassageStopStyle}>{trackName}</TD>
              </View>
              <View style={styles.simulation.endWidth}>
                <TD style={styles.simulation.stopColumn}>
                  {isLastStep || step.duration !== 0 ? Number(step.time) : ''}
                </TD>
              </View>
              <View style={styles.simulation.passageWidth}>
                <TD
                  style={{
                    ...(isStepWithDuration
                      ? {
                          width: `${step.duration < new Duration({ seconds: 600 }) && step.duration >= new Duration({ seconds: 60 }) ? 60 : 70}px`,
                          ...styles.simulation.blueStop,
                        }
                      : !isViaWithoutStop
                        ? styles.simulation.stopColumn
                        : { ...styles.simulation.stopColumn, marginLeft: '' }),
                  }}
                >
                  {isNotExtremity
                    ? step.duration !== 0
                      ? getStopDurationTime(
                          step.duration instanceof Duration
                            ? step.duration
                            : new Duration({ seconds: step.duration })
                        )
                      : secToHoursString(Number(step.time))
                    : ''}
                </TD>
              </View>
              <View style={styles.simulation.startWidth}>
                <TD style={styles.simulation.stopColumn}>
                  {isFirstStep || step.duration !== 0
                    ? 'stopEndTime' in step
                      ? step.stopEndTime
                      : ''
                    : ''}
                </TD>
              </View>
              <View style={styles.simulation.weightWidth}>
                <TD style={tdPassageStopStyle}>
                  {!isFirstStep
                    ? '='
                    : `${Math.floor(consistMass || (rollingStock?.mass ?? 0) / 1000)} t`}
                </TD>
              </View>
              {consistLength !== undefined && (
                <View style={styles.simulation.length}>
                  <TD style={tdPassageStopStyle}>{!isFirstStep ? '=' : `${consistLength} m`}</TD>
                </View>
              )}
              <View style={styles.simulation.refEngineWidth}>
                <TD style={tdPassageStopStyle}>
                  {!isFirstStep ? '=' : rollingStock?.metadata?.reference}
                </TD>
              </View>
              <View style={styles.simulation.stopType}>
                {'stopType' in step && (
                  <TD style={tdPassageStopStyle}>
                    {isFirstStep || isLastStep
                      ? t('serviceStop')
                      : capitalizeFirstLetter(t(`stdcm:trainPath.stopType.${step.stopType}`))}
                  </TD>
                )}
              </View>
            </TR>
          );
        })}
      </Table>
    </View>
  );
};

export default SimulationTable;
