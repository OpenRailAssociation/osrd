import { useMemo } from 'react';

import { Page, Text, Image, Document, View } from '@react-pdf/renderer';
import type { TFunction } from 'i18next';

import type { OperationalPointWithTimeAndSpeed } from 'applications/operationalStudies/types';
import type { PathfindingResultSuccess } from 'common/api/osrdEditoastApi';
import { useDateTimeLocale } from 'utils/date';
import { msToKmh, kgToT } from 'utils/physics';

import ConsistAndRoute from './ConsistAndRoute';
import Header from './Header';
import SimulationTable from './SimulationTable';
import styles from './styles/SimulationReportStyleSheet';
import type { RouteTableRow, SimulationSheetData } from './types';
import { formatOperationalStudiesDataForSimulationTable } from './utils/formatSimulationTable';

type SimulationReportSheetProps = {
  path: PathfindingResultSuccess;
  scenarioData: { name: string; infraName: string };
  trainData: SimulationSheetData;
  mapCanvas?: string;
  operationalPointsList: OperationalPointWithTimeAndSpeed[];
  t: TFunction<'stdcm'>;
};

const SimulationReportSheet = ({
  path,
  scenarioData,
  trainData,
  mapCanvas,
  operationalPointsList,
  t,
}: SimulationReportSheetProps) => {
  const dateTimeLocale = useDateTimeLocale();

  const { rollingStock, speedLimitByTag, creationDate, trainName } = trainData;

  const consistData = {
    rollingStockName: rollingStock.name,
    mass: Math.floor(kgToT(rollingStock.mass)),
    length: Math.floor(rollingStock.length),
    maxSpeed: Math.floor(msToKmh(rollingStock.max_speed)),
    speedLimitByTag,
  };

  const routeOperationalPoints = useMemo(() => {
    const rows: RouteTableRow[] = [];

    operationalPointsList.forEach((step, index) => {
      const isFirst = index === 0;
      const isLast = index === operationalPointsList.length - 1;
      if (!isFirst && !isLast && !step.duration) return;

      rows.push({
        name: step.name || t('reportSheet.unknown'),
        secondaryCode: step.ch ?? '',
        arrivesAt: isLast ? step.time.toLocaleString(dateTimeLocale, { timeStyle: 'short' }) : '',
        leavesAt: isFirst ? step.time.toLocaleString(dateTimeLocale, { timeStyle: 'short' }) : '',
      });
    });

    return rows;
  }, [operationalPointsList]);

  const simulationTableRows = useMemo(
    () =>
      formatOperationalStudiesDataForSimulationTable(
        operationalPointsList,
        path.path_item_positions,
        rollingStock,
        t,
        dateTimeLocale
      ),
    [operationalPointsList, path, rollingStock]
  );

  return (
    <Document>
      <Page wrap={false} style={styles.main.page} size={[1344]}>
        <Header trainName={trainName} scenarioData={scenarioData} />
        <ConsistAndRoute consist={consistData} routeTableRows={routeOperationalPoints} />
        <SimulationTable pathLength={path.length} rows={simulationTableRows} />
        {mapCanvas && (
          <View style={styles.map.map} id="simulationMap">
            <Image src={mapCanvas} />
          </View>
        )}
        <View style={styles.footer.creationDate}>
          <Text>
            {t('reportSheet.formattedDateScenario', {
              date: creationDate.toLocaleString(dateTimeLocale, { dateStyle: 'short' }),
              time: creationDate.toLocaleString(dateTimeLocale, { timeStyle: 'short' }),
            })}{' '}
          </Text>
        </View>
      </Page>
    </Document>
  );
};

export default SimulationReportSheet;
