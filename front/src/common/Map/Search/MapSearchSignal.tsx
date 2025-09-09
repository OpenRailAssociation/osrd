import { useEffect, useMemo, useRef, useState } from 'react';

import { ChevronDown, ChevronUp } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { sortBy } from 'lodash';
import { useTranslation } from 'react-i18next';

import { osrdEditoastApi } from 'common/api/osrdEditoastApi';
import type { SearchResultItemSignal, SearchPayload } from 'common/api/osrdEditoastApi';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import MultiSelectSNCF from 'common/BootstrapSNCF/MultiSelectSNCF';
import SelectImproved from 'common/BootstrapSNCF/SelectImprovedSNCF';
import SignalCard from 'common/Map/Search/SignalCard';
import {
  createMapSearchQuery,
  createTrackSystemQuery,
  computeCoordinatesOnClick,
} from 'common/Map/utils';
import { useInfraID } from 'common/osrdContext';
import { useMapSettingsActions } from 'reducers/commonMap';
import { setFailure } from 'reducers/main';
import { useAppDispatch } from 'store';
import { castErrorToFailure } from 'utils/error';
import { useDebounce } from 'utils/helpers';

type MapSearchSignalProps = {
  closeMapSearchPopUp: () => void;
};

export type SortType = {
  name: 'label' | 'type' | 'line_name' | 'line_code';
  asc: boolean;
};

const MapSearchSignal = ({ closeMapSearchPopUp }: MapSearchSignalProps) => {
  const infraID = useInfraID();
  const { selectSearchResult, updateLayersSettings } = useMapSettingsActions();

  const [searchState, setSearch] = useState('');
  const [searchLineState, setSearchLine] = useState('');
  const { t } = useTranslation();

  // NOTE: the following mappings are constants. However their values depend on
  // the translation settings. Since useTranslation is a hook these mappings
  // cannot be defined at toplevel. useMemo is just a hack to avoid redefining
  // their values at each render.
  const { SIGNALING_SYSTEMS, SIGNAL_SETTINGS_DISPLAY } = useMemo(
    () => ({
      SIGNALING_SYSTEMS: {
        ALL: t('mapSearch.all'),
        BAL: 'BAL',
        BAPR: 'BAPR',
        TVM: 'TVM',
      },
      SIGNAL_SETTINGS_DISPLAY: {
        Nf: t('mapSearch.signal-settings.Nf'),
        distant: t('mapSearch.signal-settings.distant'),
        is_430: t('mapSearch.signal-settings.is_430'),
      },
    }),
    []
  );

  const SIGNAL_SETTINGS_MAP = useMemo(
    () => ({
      [SIGNALING_SYSTEMS.ALL]: [],
      [SIGNALING_SYSTEMS.BAL]: ['Nf'],
      [SIGNALING_SYSTEMS.BAPR]: ['Nf', 'distant'],
      [SIGNALING_SYSTEMS.TVM]: ['is_430'],
    }),
    [SIGNALING_SYSTEMS]
  );

  const REVERSED_SIGNAL_SETTINGS_DISPLAY = useMemo(
    () =>
      Object.entries(SIGNAL_SETTINGS_DISPLAY).reduce(
        (acc, [key, value]) => {
          acc[value] = key;
          return acc;
        },
        {} as { [key: string]: string }
      ),
    [SIGNAL_SETTINGS_DISPLAY]
  );

  const [signalSystem, setSignalSystem] = useState(SIGNALING_SYSTEMS.ALL);
  const [signalSettings, setSignalSettings] = useState<string[]>([]);
  const [selectedSettings, setSelectedSettings] = useState<string[]>([]);
  const [searchResults, setSearchResults] = useState<SearchResultItemSignal[]>([]);
  const [autocompleteLineNames, setAutocompleteLineNames] = useState<string[]>([]);
  const [searchSignalWidth, setSearchSignalWidth] = useState<number>(0);

  // Sort by, and order true = ASC, false = DESC
  const [sortFilter, setSortFilter] = useState<SortType>({
    name: 'label',
    asc: true,
  });
  const dispatch = useAppDispatch();
  const [postSearch] = osrdEditoastApi.endpoints.postSearch.useMutation();

  const getPayload = (
    lineSearch: string,
    signalName: string,
    infraIDPayload: number,
    trackSystem: string,
    settings: string[]
  ): SearchPayload => {
    const payloadQuery = createMapSearchQuery(lineSearch, {
      codeColumn: 'line_code',
      nameColumn: 'line_name',
    });
    return {
      object: 'signal',
      query: [
        'and',
        ['=', ['infra_id'], infraIDPayload],
        !lineSearch || payloadQuery,
        !trackSystem || createTrackSystemQuery(trackSystem),
        !settings.length || ['contains', ['settings'], ['list', ...settings]],
        ['search', ['label'], signalName],
      ],
    };
  };

  const updateSearch = async (infraIDPayload: number) => {
    // display signals
    dispatch(
      updateLayersSettings({
        signals: true,
      })
    );

    const settings = selectedSettings.map((setting) => REVERSED_SIGNAL_SETTINGS_DISPLAY[setting]);
    const payload = getPayload(
      searchLineState,
      searchState,
      infraIDPayload,
      signalSystem === SIGNALING_SYSTEMS.ALL ? '' : signalSystem,
      settings
    );
    await postSearch({
      searchPayload: payload,
      pageSize: 101,
    })
      .unwrap()
      .then((results) => {
        setSearchResults([...results] as SearchResultItemSignal[]);
      })
      .catch((e) => {
        setSearchResults([]);
        dispatch(
          setFailure(castErrorToFailure(e, { name: t('mapSearch.unable-to-search-signal') }))
        );
      });
  };

  const debouncedSearchTerm = useDebounce(searchState, 300);
  const debouncedSearchLine = useDebounce(searchLineState, 300);

  useEffect(() => {
    if ((searchLineState || searchState) && infraID) {
      updateSearch(infraID);
    } else {
      setSearchResults([]);
    }
  }, [debouncedSearchTerm, debouncedSearchLine, signalSystem, selectedSettings]);

  const onResultClick = (result: SearchResultItemSignal) => {
    const lonlat = computeCoordinatesOnClick(result);

    dispatch(
      selectSearchResult({
        label: result.label,
        coordinates: lonlat,
      })
    );

    closeMapSearchPopUp();
  };

  useEffect(() => {
    const sortedResults = sortBy(searchResults, sortFilter.name);
    if (sortFilter.asc) {
      setSearchResults(sortedResults.reverse());
    } else {
      setSearchResults(sortedResults);
    }
  }, [sortFilter]);

  useEffect(() => {
    const lineNames = searchResults.map((result) => result.line_name);
    setAutocompleteLineNames([...new Set(lineNames)]);
  }, [searchLineState]);

  useEffect(() => {
    setSelectedSettings([]);
    const displayed = SIGNAL_SETTINGS_MAP[signalSystem].map(
      (signal) => SIGNAL_SETTINGS_DISPLAY[signal as keyof typeof SIGNAL_SETTINGS_DISPLAY]
    );
    setSignalSettings(displayed);
  }, [signalSystem]);

  const formatSearchResults = () => (
    <div className="search-results">
      {searchResults.map((result) => (
        <SignalCard signalSearchResult={result} onResultClick={onResultClick} key={result.obj_id} />
      ))}
    </div>
  );

  const orderDisplay = (name: string) => {
    if (name === sortFilter.name) {
      return <span className="ml-1">{sortFilter.asc ? <ChevronUp /> : <ChevronDown />}</span>;
    }
    return null;
  };

  const setSortName = (name: typeof sortFilter.name) => {
    setSortFilter({ name, asc: name === sortFilter.name ? !sortFilter.asc : false });
  };

  const divRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (divRef.current) setSearchSignalWidth(divRef.current.offsetWidth);
  }, [divRef.current?.offsetWidth]);

  return (
    <>
      <div className="row mb-2 search-signal" ref={divRef}>
        <div className={cx({ 'col-lg-4': searchSignalWidth > 768 }, 'col-md-6 mb-2')}>
          <InputSNCF
            label={t('mapSearch.line')}
            type="text"
            placeholder={t('mapSearch.placeholder-line')}
            id="map-search-signal-line"
            onChange={(e) => {
              setSearchLine(e.target.value);
            }}
            onClear={() => {
              setSearchLine('');
            }}
            value={searchLineState}
            clearButton
            noMargin
            sm
            list="line"
            focus
          />
          <datalist id="line" className="overflow-hidden">
            {searchLineState &&
              autocompleteLineNames.map((lineName) => (
                <option value={lineName} key={lineName}>
                  {lineName}
                </option>
              ))}
          </datalist>
        </div>
        <div className={cx({ 'col-lg-4': searchSignalWidth > 768 }, 'col-md-6 mb-2')}>
          <InputSNCF
            label={t('mapSearch.signal')}
            type="text"
            placeholder={t('mapSearch.placeholder-signal')}
            id="map-search-signal"
            onChange={(e) => {
              setSearch(e.target.value);
            }}
            onClear={() => {
              setSearch('');
              setSearchResults([]);
            }}
            value={searchState}
            clearButton
            noMargin
            sm
            list="signal"
          />
          <datalist id="signal">
            {searchState &&
              searchResults.map((result) => (
                <option value={result.label} key={result.obj_id}>
                  {result.label}
                </option>
              ))}
          </datalist>
        </div>
        <div
          className={cx({
            'col-lg-4': searchSignalWidth > 768,
            'col-md-6': searchSignalWidth > 470,
            'col-md-12': searchSignalWidth < 470,
          })}
        >
          <SelectImproved
            label={t('mapSearch.signal-system')}
            onChange={(e) => {
              if (e !== undefined) setSignalSystem(e);
            }}
            value={signalSystem}
            sm
            blockMenu
            options={Object.values(SIGNALING_SYSTEMS)}
          />
        </div>
        <div
          className={cx({
            'col-lg-4': searchSignalWidth > 768,
            'col-md-6': searchSignalWidth > 470,
            'col-md-12': searchSignalWidth < 470,
          })}
        >
          <MultiSelectSNCF
            multiSelectTitle={t('mapSearch.aspects')}
            multiSelectPlaceholder={t('mapSearch.no-aspect-selected')}
            options={[{ options: signalSettings }]}
            onChange={setSelectedSettings}
            selectedValues={selectedSettings}
            disable={signalSystem === SIGNALING_SYSTEMS.ALL}
          />
        </div>
      </div>
      <h2 className="text-center mt-3">
        {searchResults.length > 100
          ? t('mapSearch.too-many-results')
          : t('mapSearch.results-count', {
              count: searchResults.length,
            })}
      </h2>
      <div>
        {searchResults?.length > 0 && searchResults.length <= 100 && (
          <>
            <div className="row mt-3 mb-2 px-3 small no-gutters justify-content-between">
              <div
                className="col-1 search-results-label"
                role="button"
                onClick={() => setSortName('type')}
                tabIndex={-1}
              >
                {t('mapSearch.type')}
                {orderDisplay('type')}
              </div>
              <div
                className="col-1 search-results-label"
                role="button"
                onClick={() => setSortName('label')}
                tabIndex={-1}
              >
                {t('mapSearch.name')}
                {orderDisplay('label')}
              </div>
              <div
                className="col-3 search-results-label"
                role="button"
                onClick={() => setSortName('line_code')}
                tabIndex={-1}
              >
                {t('mapSearch.line-code')}
                {orderDisplay('line_code')}
              </div>
              <div
                className="col-6 search-results-label"
                role="button"
                onClick={() => setSortName('line_name')}
                tabIndex={-1}
              >
                {t('mapSearch.line')}
                {orderDisplay('line_name')}
              </div>
            </div>
            {formatSearchResults()}
          </>
        )}
      </div>
    </>
  );
};

export default MapSearchSignal;
