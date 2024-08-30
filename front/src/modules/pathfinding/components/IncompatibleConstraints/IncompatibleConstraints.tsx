import React, { useEffect, useMemo, useState, useCallback } from 'react';

import bbox from '@turf/bbox';
import { feature, featureCollection } from '@turf/helpers';
import length from '@turf/length';
import lineSliceAlong from '@turf/line-slice-along';
import type { LineString } from 'geojson';
import { isArray } from 'lodash';
import { useTranslation } from 'react-i18next';
import { useMap, type MapLayerMouseEvent } from 'react-map-gl/maplibre';

import type { ManageTrainSchedulePathProperties } from 'applications/operationalStudies/types';
import Collapsable from 'common/Collapsable';
import { getMapMouseEventNearestFeature } from 'utils/mapHelper';

import IncompatibleConstraintsFilters from './IncompatibleConstrainstFilters';
import IncompatibleConstraintsInfo from './IncompatibleConstrainstInfo';
import IncompatibleConstraintsLayer from './IncompatibleConstraintsLayer';
import IncompatibleConstraintsList from './IncompatibleConstraintsList';
import IncompatibleConstraintsMapFocus from './IncompatibleConstraintsMapFocus';
import {
  type FiltersConstrainstState,
  type IncompatibleConstraintEnhanced,
  type IncompatibleConstraintType,
} from './types';
import { getSegmentsConstraints, getSizeOfEnabledFilters } from './utils';

interface IncompatibleConstraintsProps {
  pathProperties?: ManageTrainSchedulePathProperties;
}

const IncompatibleConstraints = ({ pathProperties }: IncompatibleConstraintsProps) => {
  const { t } = useTranslation(['operationalStudies/manageTrainSchedule']);
  const map = useMap();

  const [filtersConstraintState, setFiltersConstraintState] = useState<FiltersConstrainstState>({});
  const [selectedConstraint, setSelectedConstraint] = useState<Set<string>>(new Set([]));
  const [hoveredConstraint, setHoveredConstraint] = useState<Set<string>>(new Set([]));
  const [total, setTotal] = useState(0);
  const [constraints, setConstraints] = useState<IncompatibleConstraintEnhanced[]>([]);

  const toggleFilter = useCallback((name: string) => {
    setFiltersConstraintState((prev) => {
      const result = { ...prev };

      const filtersName = Object.keys(prev);

      const nbEnabledBefore = getSizeOfEnabledFilters(prev);

      // If everything is selected, then we only select the provided type
      if (filtersName.length === nbEnabledBefore) {
        filtersName.forEach((filterName) => {
          if (filterName !== name) {
            result[filterName].enabled = false;
          }
        });
      } else {
        result[name].enabled = !result[name].enabled;
      }

      // if on the result, nothing is selected, then everything is selected
      const nbEnabledAfter = getSizeOfEnabledFilters(result);
      if (nbEnabledAfter === 0) {
        filtersName.forEach((e) => {
          result[e].enabled = true;
        });
      }

      return result;
    });
  }, []);

  // Function when an item is hovered in the list
  const onListItemHover = useCallback(
    (itemId: string | null) => setHoveredConstraint(new Set(itemId ? [itemId] : [])),
    []
  );

  // Function to toggle the selection of an item
  const onListItemSelected = useCallback((itemId: string) => {
    setSelectedConstraint((prev) => new Set(prev.has(itemId) ? [] : [itemId]));
  }, []);

  // On map mounted, we listen some events
  useEffect(() => {
    const fnMouseMove = (e: MapLayerMouseEvent) => {
      if (map.current?.getLayer('pathfinding-incompatible-constraints')) {
        const nearestResult = getMapMouseEventNearestFeature(e, {
          layersId: ['pathfinding-incompatible-constraints'],
        });
        if (nearestResult?.feature && nearestResult?.feature.properties.ids) {
          setHoveredConstraint(new Set(JSON.parse(nearestResult.feature.properties.ids)));
        } else {
          setHoveredConstraint(new Set([]));
        }
      }
    };
    map.current?.on('mousemove', fnMouseMove);

    const fnMouseClick = (e: MapLayerMouseEvent) => {
      if (map.current?.getLayer('pathfinding-incompatible-constraints')) {
        const nearestResult = getMapMouseEventNearestFeature(e, {
          layersId: ['pathfinding-incompatible-constraints'],
        });
        if (nearestResult?.feature && nearestResult?.feature.properties.ids) {
          setSelectedConstraint((prev) => {
            const nextSelected = JSON.parse(nearestResult.feature.properties.ids);
            if (isArray(nextSelected)) {
              // if we click on the same selected value
              // => we clear the selection
              if (prev.size === nextSelected.length && nextSelected.every((s) => prev.has(s))) {
                return new Set([]);
              }
              // select the clicked elements
              return new Set(nextSelected as string[]);
            }
            return new Set([]);
          });
        }
      }
    };
    map.current?.on('mousedown', fnMouseClick);

    return () => {
      map.current?.off('mousemove', fnMouseMove);
      map.current?.off('mousedown', fnMouseClick);
    };
  }, [map]);

  // When pathProperties changes
  //  => reset state
  useEffect(() => {
    const data =
      pathProperties?.geometry && pathProperties?.incompatibleConstraints
        ? pathProperties.incompatibleConstraints
        : undefined;

    const dataPairs = Object.entries(data || {});

    // Set filters (and remove constrainst without items)
    setFiltersConstraintState(
      dataPairs.reduce((acc, [key, value]) => {
        const count = value.length;
        if (count) return { ...acc, [key]: { count, enabled: true } };
        return acc;
      }, {})
    );

    // compute distance ratio between data & geometry
    const turfLength = pathProperties?.geometry
      ? length(feature(pathProperties?.geometry as LineString), { units: 'millimeters' })
      : 0;
    const ratio = turfLength / (pathProperties?.length || turfLength);
    const nextConstraints = dataPairs
      .map(([key, value]) =>
        value.map((e) => {
          const id = `${key}-${e.range.start}-${e.range.end}`;
          return {
            id,
            type: key as IncompatibleConstraintType,
            start: e.range.start * ratio,
            end: e.range.end * ratio,
            value: 'value' in e ? `${e.value}` : undefined,
            bbox: bbox(
              lineSliceAlong(
                pathProperties?.geometry as LineString,
                e.range.start * ratio,
                e.range.end * ratio,
                {
                  units: 'millimeters',
                }
              )
            ) as [number, number, number, number],
          };
        })
      )
      .flat();
    setConstraints(nextConstraints);
    setTotal(nextConstraints.length);
    setSelectedConstraint(new Set([]));
    setHoveredConstraint(new Set([]));
  }, [pathProperties?.incompatibleConstraints]);

  const filteredConstraints = useMemo(
    () => constraints.filter((c) => filtersConstraintState[c.type]?.enabled),
    [constraints, filtersConstraintState]
  );

  const filteredGeojson = useMemo(() => {
    if (!pathProperties?.geometry || filteredConstraints.length === 0)
      return featureCollection<LineString, { ids: string[] }>([]);
    return getSegmentsConstraints(pathProperties?.geometry as LineString, filteredConstraints);
  }, [pathProperties?.geometry, filteredConstraints]);

  if (total === 0) return null;
  return (
    <>
      <Collapsable
        className="rounded"
        style={{
          zIndex: 2,
          position: 'absolute',
          bottom: '2em',
          right: '1em',
          backgroundColor: 'rgba(255,255,255,0.9)',
        }}
      >
        <>
          <div className="d-flex justify-content-between">
            <h5 className="flex-grow-1 mb-0">
              {filteredConstraints.length !== total
                ? t('incompatibleConstraints.title_on', {
                    count: filteredConstraints.length,
                    total,
                  })
                : t('incompatibleConstraints.title', { total })}
            </h5>
            <IncompatibleConstraintsInfo className="flex-grow-0 mx-2" />
            <IncompatibleConstraintsMapFocus geojson={filteredGeojson} />
          </div>
          <IncompatibleConstraintsFilters
            className="d-flex align-self-center"
            data={filtersConstraintState}
            toggleFilter={toggleFilter}
          />
        </>
        <div
          className="mt-2 pr-2"
          style={{ maxHeight: '30vh', maxWidth: '30vw', overflow: 'auto' }}
        >
          <IncompatibleConstraintsList
            data={filteredConstraints}
            hovered={hoveredConstraint}
            selected={selectedConstraint}
            onHover={onListItemHover}
            onSelect={onListItemSelected}
          />
        </div>
      </Collapsable>
      {pathProperties?.geometry && (
        <IncompatibleConstraintsLayer
          geojson={filteredGeojson}
          hovered={hoveredConstraint}
          selected={selectedConstraint}
        />
      )}
    </>
  );
};

export default IncompatibleConstraints;
