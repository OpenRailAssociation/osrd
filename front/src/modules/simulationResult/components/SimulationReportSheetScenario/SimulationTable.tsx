import { Table, TR, TH, TD } from '@ag-media/react-pdf-table';
import { View } from '@react-pdf/renderer';
import { useTranslation } from 'react-i18next';

import type { OperationalPointWithTimeAndSpeed } from 'applications/operationalStudies/types';
import styles from 'applications/stdcm/components/SimulationReportSheet/SimulationReportStyleSheet';
import { getStopDurationTime } from 'applications/stdcm/utils/formatSimulationReportSheet';
import type { PathfindingResultSuccess } from 'common/api/osrdEditoastApi';
import { secToHoursString } from 'utils/timeManipulation';

import type { SimulationSheetData } from '../SimulationResultExport/types';

interface SimulationTableProps {
  trainData: SimulationSheetData;
  operationalPointsList: OperationalPointWithTimeAndSpeed[];
  path: PathfindingResultSuccess;
}

const SimulationTable = ({ trainData, operationalPointsList, path }: SimulationTableProps) => {
  const { t } = useTranslation([
    'stdcm-simulation-report-sheet',
    'stdcm',
    'operationalStudies/study',
  ]);

  const { rollingStock } = trainData;

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
          <View style={styles.simulation.refEngineWidth}>
            <TD>{t('referenceEngine')}</TD>
          </View>
          <View style={styles.simulation.convSignWidth}>
            <TD>{t('conventionalSign')}</TD>
          </View>
          <View style={styles.simulation.crossedATEWidth}>
            <TD>{t('crossedATE')}</TD>
          </View>
        </TH>
        {operationalPointsList.map((step, index) => {
          const isFirstStep = index === 0;
          const isLastStep = index === operationalPointsList.length - 1;
          const isNotExtremity = !isFirstStep && !isLastStep;
          const prevStep = operationalPointsList[index - 1];
          const trackName = step.track_name || '-';
          const isWaypoint = path.path_item_positions
            .slice(1, -1)
            .some((pos) => pos / 1000 === step.position);
          const isViaWithoutStop = isWaypoint && step.duration === 0;
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
                  {isNotExtremity && !isWaypoint && step.name === prevStep.name
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
                <TD style={styles.simulation.td}>{trackName}</TD>
              </View>
              <View style={styles.simulation.endWidth}>
                <TD style={styles.simulation.stopColumn}>
                  {isLastStep || step.duration !== 0 ? secToHoursString(step.time) : ''}
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
                        : secToHoursString(step.time)
                      : ''
                  }
                </TD>
              </View>
              <View style={styles.simulation.startWidth}>
                <TD style={styles.simulation.stopColumn}>
                  {isFirstStep || step.duration !== 0
                    ? secToHoursString(step.time + step.duration)
                    : ''}
                </TD>
              </View>
              <View style={styles.simulation.weightWidth}>
                <TD style={tdPassageStopStyle}>
                  {!isFirstStep ? '=' : `${Math.floor(rollingStock?.mass / 1000)} t`}
                </TD>
              </View>
              <View style={styles.simulation.refEngineWidth}>
                <TD style={tdPassageStopStyle}>
                  {!isFirstStep ? '=' : rollingStock?.metadata?.reference}
                </TD>
              </View>
              <View style={styles.simulation.convSignWidth}>
                <TD style={tdPassageStopStyle} aria-label="conventionalSign" />
              </View>
              <View style={styles.simulation.crossedATEWidth}>
                <TD style={tdPassageStopStyle} aria-label="crossedATE" />
              </View>
            </TR>
          );
        })}
      </Table>
      <View style={styles.simulation.horizontalBar} />
    </View>
  );
};

export default SimulationTable;
