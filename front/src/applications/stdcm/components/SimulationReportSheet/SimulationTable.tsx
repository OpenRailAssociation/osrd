import { Table, TR, TH, TD } from '@ag-media/react-pdf-table';
import { View } from '@react-pdf/renderer';
import { useTranslation } from 'react-i18next';

import type { StdcmResultsOperationalPoint, StdcmSuccessResponse } from 'applications/stdcm/types';
import { getStopDurationTime } from 'applications/stdcm/utils/formatSimulationReportSheet';
import { capitalizeFirstLetter } from 'utils/strings';

import { getSecondaryCode } from './helpers';
import styles from './SimulationReportStyleSheet';

interface SimulationTableProps {
  stdcmData: StdcmSuccessResponse;
  operationalPointsList: StdcmResultsOperationalPoint[];
  consistMass: number;
  consistLength: number;
}

const SimulationTable = ({
  stdcmData,
  operationalPointsList,
  consistMass,
  consistLength,
}: SimulationTableProps) => {
  const { t } = useTranslation(['stdcm-simulation-report-sheet', 'stdcm']);

  const { rollingStock } = stdcmData;

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
          <View style={styles.simulation.length}>
            <TD>{t('length')}</TD>
          </View>
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
          const isViaInSimulationPath = stdcmData.simulationPathSteps
            .slice(1, -1)
            .some(
              (s) => s.location && s.location.name === step.name && getSecondaryCode(s) === step.ch
            );
          const isViaWithoutStop = isViaInSimulationPath && step.duration === 0;
          const isNotExtremity = !isFirstStep && !isLastStep;
          const isStepWithDuration = step.duration !== 0 && !isLastStep;
          const tdPassageStopStyle = !isViaWithoutStop
            ? styles.simulation.td
            : { ...styles.simulation.td, paddingLeft: '' };
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
                    // eslint-disable-next-line no-nested-ternary
                    isViaWithoutStop
                      ? styles.simulation.opColumnPassageStop
                      : isNotExtremity && step.duration !== 0
                        ? styles.simulation.opStop
                        : styles.simulation.td
                  }
                >
                  {isNotExtremity && !isViaInSimulationPath && step.name === prevStep.name
                    ? '='
                    : step.name || 'Unknown'}
                </TD>
              </View>
              <View style={styles.simulation.chWidth}>
                <TD
                  style={
                    isViaWithoutStop
                      ? styles.simulation.chColumnPassageStop
                      : styles.simulation.chColumn
                  }
                >
                  {step.ch}
                </TD>
              </View>
              <View style={styles.simulation.trackWidth}>
                <TD style={styles.simulation.td}>{step.trackName}</TD>
              </View>
              <View style={styles.simulation.endWidth}>
                <TD style={styles.simulation.stopColumn}>
                  {isLastStep || step.duration !== 0 ? step.time : ''}
                </TD>
              </View>
              <View style={styles.simulation.passageWidth}>
                <TD
                  style={{
                    // eslint-disable-next-line no-nested-ternary
                    ...(isStepWithDuration
                      ? {
                          width: `${step.duration < 600 && step.duration >= 60 ? 60 : 70}px`,
                          ...styles.simulation.blueStop,
                        }
                      : !isViaWithoutStop
                        ? styles.simulation.stopColumn
                        : { ...styles.simulation.stopColumn, marginLeft: '' }),
                  }}
                >
                  {
                    // eslint-disable-next-line no-nested-ternary
                    isNotExtremity
                      ? step.duration !== 0
                        ? getStopDurationTime(step.duration)
                        : step.time
                      : ''
                  }
                </TD>
              </View>
              <View style={styles.simulation.startWidth}>
                <TD style={styles.simulation.stopColumn}>
                  {isFirstStep || step.duration !== 0 ? step.stopEndTime : ''}
                </TD>
              </View>
              <View style={styles.simulation.weightWidth}>
                <TD style={tdPassageStopStyle}>
                  {!isFirstStep ? '=' : `${Math.floor(consistMass)} t`}
                </TD>
              </View>
              <View style={styles.simulation.length}>
                <TD style={tdPassageStopStyle}>{!isFirstStep ? '=' : `${consistLength} m`}</TD>
              </View>
              <View style={styles.simulation.refEngineWidth}>
                <TD style={tdPassageStopStyle}>
                  {!isFirstStep ? '=' : rollingStock.metadata?.reference}
                </TD>
              </View>
              <View style={styles.simulation.stopType}>
                {(isFirstStep || isLastStep || step.stopType) && (
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
