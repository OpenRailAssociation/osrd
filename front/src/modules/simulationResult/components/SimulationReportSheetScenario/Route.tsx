import { Table, TR, TH, TD } from '@ag-media/react-pdf-table';
import { Text, View } from '@react-pdf/renderer';
import { useTranslation } from 'react-i18next';

import type { OperationalPointWithTimeAndSpeed } from 'applications/operationalStudies/types';
import styles from 'applications/stdcm/components/SimulationReportSheet/SimulationReportStyleSheet';
import { secToHoursString } from 'utils/timeManipulation';

interface RouteProps {
  operationalPointsList: OperationalPointWithTimeAndSpeed[];
}

const Route = ({ operationalPointsList }: RouteProps) => {
  const { t } = useTranslation([
    'stdcm-simulation-report-sheet',
    'stdcm',
    'operationalStudies/study',
  ]);

  let renderedIndex = 0;

  return (
    <View style={styles.consistAndRoute.route}>
      <Text style={styles.consistAndRoute.routeTitle}>{t('requestedRoute')}</Text>
      <View style={styles.consistAndRoute.stopTableContainer}>
        <Table style={styles.consistAndRoute.stopTable}>
          <TH style={styles.consistAndRoute.stopTableTH}>
            <View style={styles.consistAndRoute.stopTableIndexWidth}>
              <TD aria-label="line-count" />
            </View>
            <View style={styles.consistAndRoute.stopTableOpWidth}>
              <TD>{t('operationalPoint')}</TD>
            </View>
            <View style={styles.consistAndRoute.stopTableChWidth}>
              <TD>{t('code')}</TD>
            </View>
            <View style={styles.consistAndRoute.stopTableEndWidth}>
              <TD>{t('endStop')}</TD>
            </View>
            <View style={styles.consistAndRoute.stopTableStartWidth}>
              <TD>{t('startStop')}</TD>
            </View>
            <View style={styles.consistAndRoute.stopTableStopTypeWidth} />
          </TH>
          {operationalPointsList.map((step, index) => {
            const isFirstStep = index === 0;
            const isLastStep = index === operationalPointsList.length - 1;
            const shouldRenderRow = isFirstStep || step.duration > 0 || isLastStep;
            if (shouldRenderRow) {
              renderedIndex += 1;
              return (
                <TR key={index} style={styles.consistAndRoute.stopTableTbody}>
                  <View style={styles.consistAndRoute.stopTableIndexWidth}>
                    <TD style={styles.consistAndRoute.stopTableIndexColumn}>{renderedIndex}</TD>
                  </View>
                  <View style={styles.consistAndRoute.stopTableOpWidth}>
                    <TD style={styles.consistAndRoute.stopTableOpColumn}>
                      {step.name || 'Unknown'}
                    </TD>
                  </View>
                  <View style={styles.consistAndRoute.stopTableChWidth}>
                    <TD style={styles.consistAndRoute.stopTableChColumn}>{step.ch}</TD>
                  </View>
                  <View style={styles.consistAndRoute.stopTableEndWidth}>
                    <TD style={styles.consistAndRoute.stopTableStartColumn}>
                      {isLastStep ? secToHoursString(step.time) : ''}
                    </TD>
                  </View>
                  <View style={styles.consistAndRoute.stopTableStartWidth}>
                    <TD style={styles.consistAndRoute.stopTableStartColumn}>
                      {isFirstStep ? secToHoursString(step.time) : ''}
                    </TD>
                  </View>
                </TR>
              );
            }
            return null;
          })}
        </Table>
      </View>
    </View>
  );
};

export default Route;
