import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import turfCenter from '@turf/center';
import nextId from 'react-id-generator';
import { Viewport, updateMapSearchMarker } from 'reducers/map';
import { useDebounce } from 'utils/helpers';
import { useTranslation } from 'react-i18next';
import { getMap } from 'reducers/map/selectors';
import { Geometry } from '@turf/helpers';
import MultiSelectSNCF from 'common/BootstrapSNCF/MultiSelectSNCF';
import { ISignalSearchResult } from './searchTypes';

type MapSearchSignalProps = {
  updateExtViewport: (viewport: Partial<Viewport>) => void;
};

const MapSearchSignal = ({ updateExtViewport }: MapSearchSignalProps) => {
  const map = useSelector(getMap);

  const [searchState, setSearch] = useState('');
  const [searchLineState, setSearchLine] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [aspect, setAspect] = useState<string[]>([]);
  const dispatch = useDispatch();

  const { t } = useTranslation(['translation', 'map-search']);

  // const updateSearch = async (params) => {
  //   try {
  //     const data = await get(searchURI, { params });
  //     setSearchResults(data);
  //   } catch (e) {
  //     /* empty */
  //   }
  // };

  const debouncedSearchTerm = useDebounce(searchState, 300);
  const debouncedSearchLine = useDebounce(searchLineState, 300);

  useEffect(() => {
    // if (!dontSearch && (debouncedSearchTerm || debouncedSearchLine)) {
    //   const params = {};
    //   if (searchState !== '') {
    //     params.name = searchState;
    //   }
    //   if (searchLineState !== '') {
    //     params.linecode = searchLineState;
    //   }
    //   updateSearch(params);
    // }
  }, [debouncedSearchTerm, debouncedSearchLine]);

  const onResultClick = (result: ISignalSearchResult) => {
    const coordinates = map.mapTrackSources === 'schematic' ? result.schematic : result.geographic;

    const center = turfCenter({ coordinates } as Geometry);

    const newViewport = {
      ...map.viewport,
      longitude: center.geometry.coordinates[0],
      latitude: center.geometry.coordinates[1],
      zoom: 12,
    };
    updateExtViewport(newViewport);
    dispatch(
      updateMapSearchMarker({
        title: result.label,
        lonlat: [center.geometry.coordinates[0], center.geometry.coordinates[1]],
      })
    );
  };

  const formatSearchResults = () =>
    searchResults.map((result) => (
      <div
        role="button"
        tabIndex={-1}
        className="row search-result-table-item align-items-center"
        key={nextId()}
        onClick={() => onResultClick(result)}
      >
        {/* <div className="col-1">
          <img src={`/signalsSVG/${result.type.replace(/ /g, '_')}.svg`} alt={result.type} />
        </div>
        <div className="col-1 small">{result.name}</div>
        <div className="col-3">{result.stationname}</div>
        <div className="col-2">{result.linecode}</div>
        <div className="col-3 small">{result.trackname}</div>
        <div className="col-2">
          <small>{result.pk}</small>
        </div> */}
      </div>
    ));

  const signalAspects = [
    { label: 'Feu Vert' },
    { label: 'Feu Vert Clignotant' },
    { label: '320' },
    { label: '300' },
    { label: '270' },
    { label: '230' },
    { label: '220' },
    { label: '200' },
    { label: '170' },
    { label: '160' },
    { label: '130' },
    { label: '60' },
    { label: '80' },
    { label: 'Ralentissement 60' },
    { label: 'Rappel 60' },
    { label: 'Ralentissement 30' },
    { label: 'Rappel 30' },
    { label: 'Avertissement' },
    { label: 'Feu Rouge Clignotant' },
    { label: '3 Feux' },
    { label: 'Feu Blanc' },
    { label: 'Disque' },
    { label: 'Bande Verte Vertical' },
    { label: '1 Feu' },
    { label: 'Bande Rouge Horizontal' },
    { label: 'Sémaphore' },
    { label: '4 Feux' },
    { label: 'Bande bl/jau Vertical' },
    { label: 'Carré' },
    { label: 'R Blanc' },
    { label: 'Feu blanc franchissement' },
    { label: 'Feu Jaune Clignotant' },
    { label: 'Bande Blanche Vertical' },
    { label: '2 Feux' },
    { label: 'Carré Violet' },
    { label: 'Feu Blanc Clignotant' },
    { label: 'Bande Jaune Inclinee' },
    { label: '5 Feux' },
    { label: 'Croix Blanche Lumineuse' },
  ];

  return (
    <>
      <div className="row mr-2">
        <div className="col-sm-6">
          <InputSNCF
            label={t('map-search:name')}
            type="text"
            placeholder={t('map-search:placeholdername')}
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
          />
        </div>
        <div className="col-sm-6">
          <InputSNCF
            label={t('map-search:linecode')}
            type="text"
            placeholder={t('map-search:placeholderline')}
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
          />
        </div>
      </div>
      <div>
        <MultiSelectSNCF
          multiSelectTitle="Aspect"
          multiSelectSubTitle="Tout les Aspects"
          selectOptions={signalAspects}
          onChange={setAspect}
          selectedValues={aspect}
        />
      </div>
      <div>
        {searchResults.length > 0 ? (
          <>
            <div className="row mt-3 px-3 small no-gutters">
              <div
                className="col-1 search-results-label"
                role="button"
                // onClick={() => setSortName('type')}
                tabIndex={-1}
              >
                {t('map-search:type')}
                {/* {orderDisplay('type')} */}
              </div>
              <div
                className="col-1 search-results-label"
                role="button"
                // onClick={() => setSortName('name')}
                tabIndex={-1}
              >
                {t('map-search:name')}
                {/* {orderDisplay('name')} */}
              </div>
              <div
                className="col-3 search-results-label"
                role="button"
                // onClick={() => setSortName('stationname')}
                tabIndex={-1}
              >
                {t('map-search:station')}
                {/* {orderDisplay('stationname')} */}
              </div>
              <div
                className="col-2 search-results-label"
                role="button"
                // onClick={() => setSortName('linecode')}
                tabIndex={-1}
              >
                {t('map-search:linecode')}
                {/* {orderDisplay('linecode')} */}
              </div>
              <div
                className="col-3 search-results-label"
                role="button"
                // onClick={() => setSortName('trackname')}
                tabIndex={-1}
              >
                {t('map-search:trackname')}
                {/* {orderDisplay('trackname')} */}
              </div>
              <div
                className="col-2 search-results-label"
                role="button"
                // onClick={() => setSortName('pk')}
                tabIndex={-1}
              >
                {t('map-search:pk')}
                {/* {orderDisplay('pk')} */}
              </div>
            </div>
            <div className="search-results">{formatSearchResults()}</div>
          </>
        ) : (
          <h2 className="text-center mt-3">{t('map-search:noresult')}</h2>
        )}
      </div>
    </>
  );
};

export default MapSearchSignal;
