/* eslint-disable no-console */
import { useMemo, useState } from 'react';

import { DatePicker, Input } from '@osrd-project/ui-core';
import { ArrowUp } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import {
  osrdEditoastApi,
  type SearchPayload,
  type SearchResultItemTrainSchedule,
} from 'common/api/osrdEditoastApi';
import { useOsrdConfSelectors } from 'common/osrdContext';

import StdcmCard from './StdcmCard';
import StdcmDefaultCard from './StdcmDefaultCard';
import StdcmLinkedPathResult from './StdcmLinkedPathResult';

type PathItemOperationalPoint = {
  operational_point: string;
  deleted?: boolean;
  id: string;
};

function compareDateandISODate(searchDate: Date, isoDate: string) {
  const searchDateISO = searchDate.toISOString().substring(0, 10);
  console.log('compare dates -- ', {
    searchDateISO,
    searchDatePasSubstring: searchDate.toISOString(),
    isoDate,
  });
  return searchDateISO === isoDate;
}

const StdcmLinkedPathSearch = () => {
  const { t } = useTranslation('stdcm');

  const [postSearch] = osrdEditoastApi.endpoints.postSearch.useMutation();
  const [getRollingStockByName] =
    osrdEditoastApi.endpoints.getRollingStockNameByRollingStockName.useLazyQuery();

  const { getTimetableID, getSearchDatetimeWindow } = useOsrdConfSelectors();
  const timetableID = useSelector(getTimetableID);
  const searchDatetimeWindow = useSelector(getSearchDatetimeWindow);

  const selectableSlot = useMemo(
    () =>
      searchDatetimeWindow
        ? {
            start: searchDatetimeWindow.begin,
            end: searchDatetimeWindow.end,
          }
        : undefined,
    [searchDatetimeWindow]
  );

  const [linkedPathID, setLinkedPathID] = useState<string>();
  const [linkedPathDate, setLinkedPathDate] = useState<Date | undefined>(
    searchDatetimeWindow?.begin
  );
  const [displayLinkedPathSearch, setShowLinkedPathSearch] = useState<boolean>(false);

  const searchPayload = useMemo(
    () =>
      ({
        object: 'trainschedule',
        query: [
          'and',
          ['search', ['train_name'], linkedPathID],
          ['=', ['timetable_id'], timetableID!],
        ],
      }) as SearchPayload,
    [timetableID, linkedPathID]
  );

  const testOpSearch = async (IDsList: (string | string[])[][]) => {
    try {
      const payloadOP = {
        object: 'operationalpoint',
        query: ['or', ...IDsList],
      };
      const resultsOP = await postSearch({
        searchPayload: payloadOP,
        pageSize: 25,
      }).unwrap();
      console.log('Resultat recherche operational_point ==> ', resultsOP);
    } catch (error) {
      console.log('op search failed D: ');
    }
  };

  const testRollingStockSearch = async (rollingStockName: string) => {
    try {
      const rollingStock = await getRollingStockByName({
        rollingStockName,
      }).unwrap();
      console.log('Resultat recherche rolling stock ==> ', rollingStock);
      // dispatch(updateRollingStockID(rollingStock.id));
    } catch (error) {
      console.log('rs search failed D: ');
    }
  };

  const testTrainScheduleSearch = async () => {
    console.log('searchPayload', searchPayload);

    try {
      const results = (await postSearch({
        searchPayload,
        pageSize: 25,
      }).unwrap()) as SearchResultItemTrainSchedule[];
      const opIdsList = results.map((r) =>
        r.path.map((p) => ['=', ['obj_id'], (p as PathItemOperationalPoint).operational_point])
      );
      console.log('trainschedule search results -- ', {
        results,
        testDateComparator: compareDateandISODate(linkedPathDate!, results[0].start_time),
      });
      testOpSearch(opIdsList[0]); // FILTRER AVEC DATE DEMANDEE
      testRollingStockSearch(results[0].rolling_stock_name);
    } catch (error) {
      console.log('OOPSIIE ', []);
    }
  };

  return (
    <div className="stdcm-linked-path-search-container">
      {!displayLinkedPathSearch ? (
        <button type="button" onClick={() => setShowLinkedPathSearch(true)}>
          <StdcmDefaultCard
            hasTip
            text="Indiquer le sillon antérieur"
            Icon={<ArrowUp size="lg" />}
          />
        </button>
      ) : (
        <StdcmCard
          name={t('trainPath.vias')}
          title={
            <button type="button" onClick={() => setShowLinkedPathSearch(false)}>
              {t('translation:common.delete')}
            </button>
          }
          hasTip
          className="via"
        >
          <div>
            <div>
              <div className="d-flex pr-1 pl-3">
                <Input
                  id="linked-path-ID"
                  type="text"
                  value={linkedPathID || ''}
                  onChange={(e) => {
                    setLinkedPathID(e.target.value);
                  }}
                  label="N°"
                />
                <DatePicker
                  inputProps={{
                    id: `linked-path-date`,
                    label: 'Date',
                    name: 'op-date',
                    onChange: () => {},
                  }}
                  selectableSlot={linkedPathDate ? selectableSlot : undefined}
                  value={linkedPathDate}
                  onDateChange={(e) => {
                    setLinkedPathDate(e);
                  }}
                />
              </div>
              <button
                className="stdcm-linked-path-button"
                type="button"
                onClick={testTrainScheduleSearch}
              >
                Trouver
              </button>
            </div>
            <StdcmLinkedPathResult />
          </div>
        </StdcmCard>
      )}
    </div>
  );
};

export default StdcmLinkedPathSearch;
