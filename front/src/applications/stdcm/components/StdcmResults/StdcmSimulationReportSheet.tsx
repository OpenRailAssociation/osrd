import { useMemo } from 'react';

import { Page, Text, Document, View, Image } from '@react-pdf/renderer';
import { useTranslation } from 'react-i18next';

import type {
  LinkedTrains,
  SimilarTrainWithSecondaryCode,
  StdcmResultsOperationalPoint,
  StdcmSimulationInputs,
  StdcmSuccessResponse,
} from 'applications/stdcm/types';
import { formatStdcmDataForSimulationTable } from 'applications/stdcm/utils/simulationOutputUtils';
import iconAlert from 'assets/simulationReportSheet/icon_alert_fill.png';
import ConsistAndRoute from 'modules/SimulationReportSheet/ConsistAndRoute';
import Header from 'modules/SimulationReportSheet/Header';
import RCInfo from 'modules/SimulationReportSheet/RCInfo';
import SimilarTrainsToDuplicate from 'modules/SimulationReportSheet/SimilarTrainsToDuplicate';
import SimulationTable from 'modules/SimulationReportSheet/SimulationTable';
import styles from 'modules/SimulationReportSheet/styles/SimulationReportStyleSheet';
import type { ConsistChangeData, RouteTableRow } from 'modules/SimulationReportSheet/types';
import {
  getArrivalTimes,
  getSecondaryCode,
} from 'modules/SimulationReportSheet/utils/formatSimulationReportSheet';
import { useDateTimeLocale } from 'utils/date';
import { kgToT, msToKmh } from 'utils/physics';

type StdcmSimulationReportSheetProps = {
  stdcmLinkedTrains: LinkedTrains;
  stdcmData: StdcmSuccessResponse;
  consist: StdcmSimulationInputs['consist'];
  simulationReportSheetNumber: string;
  operationalPointsList: StdcmResultsOperationalPoint[];
  simulationSheetLogo?: string;
  similarTrains: SimilarTrainWithSecondaryCode[];
};

const StdcmSimulationReportSheet = ({
  stdcmLinkedTrains,
  stdcmData,
  consist,
  simulationReportSheetNumber,
  operationalPointsList,
  simulationSheetLogo,
  similarTrains,
}: StdcmSimulationReportSheetProps) => {
  const { t } = useTranslation('stdcm');
  const dateTimeLocale = useDateTimeLocale();

  const { rollingStock, speedLimitByTag, departure_time: departureTime, creationDate } = stdcmData;

  const consistData = {
    rollingStockName: rollingStock.name,
    mass: `${consist.totalMass ?? Math.floor(kgToT(rollingStock.mass))} t`,
    length: `${consist.totalLength ?? Math.floor(rollingStock.length)} m`,
    maxSpeed: `${consist.maxSpeed ?? Math.floor(msToKmh(rollingStock.max_speed))} km/h`,
    speedLimitByTag,
    loadingGauge: consist.loadingGauge,
    towedRollingStockName: consist.towedRollingStock?.name,
  };

  const routeOperationalPoints = useMemo(() => {
    const rows: RouteTableRow[] = [];
    stdcmData.simulationPathSteps.forEach((step, index) => {
      const row: RouteTableRow = {
        name: step.operationalPoint?.name || '',
        secondaryCode: getSecondaryCode(step),
        italic: true,
      };
      if (step.isVia) {
        row.passageStop = step.stopFor;
        row.stopType = step.stopType;
      } else {
        const isFirst = index === 0;
        const isLast = index === stdcmData.simulationPathSteps.length - 1;
        row.arrivesAt = isLast ? getArrivalTimes(step, t, dateTimeLocale) : '';
        row.leavesAt = isFirst ? getArrivalTimes(step, t, dateTimeLocale) : '';
        if (step.arrivalType === 'preciseTime') {
          row.tolerances = step.tolerances;
          row.italic = false;
        }
      }
      rows.push(row);
    });
    return rows;
  }, [stdcmData.simulationPathSteps]);

  const simulationTableRows = useMemo(
    () =>
      formatStdcmDataForSimulationTable(
        operationalPointsList,
        stdcmData.simulationPathSteps,
        {
          rollingStockName: rollingStock.name,
          mass: consist.totalMass ?? kgToT(rollingStock.mass),
          length: consist.totalLength ?? rollingStock.length,
        },
        t
      ),
    [operationalPointsList, rollingStock, stdcmData, consistData]
  );

  const consistChangesData: ConsistChangeData[] = simulationTableRows.reduce<ConsistChangeData[]>(
    (rowsAcc, currentRow) => {
      if (currentRow.consistChanges) {
        const updatedConsist = currentRow.consistChanges.updatedConsist;
        rowsAcc.push({
          name: currentRow.name,
          secondaryCode: currentRow.ch ?? '',
          totalLength: updatedConsist.totalLength,
          totalMass: updatedConsist.totalMass,
          rollingStockName: updatedConsist.rollingStockName,
          towedRollingStockName: updatedConsist.towedRollingStockName,
        });
      }
      return rowsAcc;
    },
    []
  );

  return (
    <Document>
      <Page wrap={false} style={styles.main.page} size={[1344]}>
        <View style={styles.header.alertBanner}>
          <Image src={iconAlert} style={styles.header.alertIcon} />
          <Text style={styles.header.simulationTitle}>{t('reportSheet.simulation')}</Text>
          <Text style={styles.header.message}>{t('reportSheet.warningMessage')}</Text>
        </View>
        <Header
          simulationReportSheetNumber={simulationReportSheetNumber}
          simulationSheetLogo={simulationSheetLogo}
          creationDate={creationDate}
        />
        <RCInfo departureTime={departureTime} />
        <ConsistAndRoute
          isStdcm
          initialConsist={consistData}
          stdcmLinkedTrains={stdcmLinkedTrains}
          routeTableRows={routeOperationalPoints}
          consistChanges={consistChangesData}
        />
        <SimilarTrainsToDuplicate similarTrains={similarTrains} />
        <SimulationTable
          isStdcm
          rows={simulationTableRows}
          pathLength={stdcmData.pathfinding_result.length}
          traceId={stdcmData.traceId}
        />
        <View style={styles.footer.warrantyBox}>
          <Text style={styles.footer.warrantyMessage}>{t('reportSheet.withoutWarranty')}</Text>
        </View>
      </Page>
    </Document>
  );
};

export default StdcmSimulationReportSheet;
