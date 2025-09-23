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
import iconAlert from 'assets/simulationReportSheet/icon_alert_fill.png';
import ConsistAndRoute from 'modules/SimulationReportSheet/ConsistAndRoute';
import Header from 'modules/SimulationReportSheet/Header';
import RCInfo from 'modules/SimulationReportSheet/RCInfo';
import SimilarTrainsToDuplicate from 'modules/SimulationReportSheet/SimilarTrainsToDuplicate';
import SimulationTable from 'modules/SimulationReportSheet/SimulationTable';
import styles from 'modules/SimulationReportSheet/styles/SimulationReportStyleSheet';
import type { RouteTableRow } from 'modules/SimulationReportSheet/types';
import {
  getArrivalTimes,
  getSecondaryCode,
} from 'modules/SimulationReportSheet/utils/formatSimulationReportSheet';
import { formatStdcmDataForSimulationTable } from 'modules/SimulationReportSheet/utils/formatSimulationTable';
import { useDateTimeLocale } from 'utils/date';
import { msToKmh, tToKg } from 'utils/physics';

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
    mass: consist?.totalMass ?? Math.floor(tToKg(rollingStock.mass)),
    length: consist?.totalLength ?? Math.floor(rollingStock.length),
    maxSpeed: consist?.maxSpeed ?? Math.floor(msToKmh(rollingStock.max_speed)),
    speedLimitByTag,
    loadingGauge: consist?.loadingGauge,
    towedRollingStockName: consist?.towedRollingStock?.name,
  };

  const routeOperationalPoints = useMemo(() => {
    const rows: RouteTableRow[] = [];
    stdcmData.simulationPathSteps.forEach((step, index) => {
      const row: RouteTableRow = {
        name: step.location?.name || '',
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
          mass: consistData.mass,
          length: consistData.length,
        },
        t
      ),
    [operationalPointsList, rollingStock, stdcmData, consistData]
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
          consist={consistData}
          stdcmLinkedTrains={stdcmLinkedTrains}
          routeTableRows={routeOperationalPoints}
        />
        <SimilarTrainsToDuplicate similarTrains={similarTrains} />
        <SimulationTable
          isStdcm
          rows={simulationTableRows}
          pathLength={stdcmData.pathfinding_result.length}
        />
        <View style={styles.footer.warrantyBox}>
          <Text style={styles.footer.warrantyMessage}>{t('reportSheet.withoutWarranty')}</Text>
        </View>
      </Page>
    </Document>
  );
};

export default StdcmSimulationReportSheet;
