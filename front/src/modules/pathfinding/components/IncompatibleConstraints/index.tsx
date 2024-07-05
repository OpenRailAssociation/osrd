import React, { type FC, useEffect, useMemo, useState, useCallback } from 'react';

import bbox from '@turf/bbox';
import { feature, featureCollection } from '@turf/helpers';
import length from '@turf/length';
import lineSliceAlong from '@turf/line-slice-along';
import type { LineString } from 'geojson';
import { isArray, isNil, toPairs } from 'lodash';
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
import { type IncompatibleConstraintItemEnhanced } from './type';
import { getSegmentsConstraints } from './utils';

interface IncompatibleConstraintsProps {
  pathProperties?: ManageTrainSchedulePathProperties;
}

const IncompatibleConstraints: FC<IncompatibleConstraintsProps> = ({ pathProperties }) => {
  const { t } = useTranslation(['operationalStudies/manageTrainSchedule']);
  const map = useMap();

  const [types, setTypes] = useState<Record<string, { count: number; enabled: boolean }>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set([]));
  const [hovered, setHovered] = useState<Set<string>>(new Set([]));
  const [total, setTotal] = useState<number>(0);
  const [constraints, setConstraints] = useState<IncompatibleConstraintItemEnhanced[]>([]);

  // Function to toggle a type for the filters
  const toggleType = useCallback((name: string) => {
    setTypes((prev) => {
      const result = { ...prev };

      const filtersName = toPairs(prev)
        .filter(([, value]) => value.count)
        .map(([key]) => key);
      const nbEnabledBefore = toPairs(prev).filter(
        ([, value]) => value.count > 0 && value.enabled === true
      ).length;

      // If everything is selected, then we only select the provided type
      if (filtersName.length === nbEnabledBefore) {
        filtersName
          .filter((filter) => filter !== name)
          .forEach((e) => {
            result[e].enabled = false;
          });
      } else {
        result[name].enabled = !result[name].enabled;
      }

      // if on the result, nothing is selcted, then everything is selected
      const nbEnabledAfter = toPairs(result).filter(
        ([, value]) => value.count > 0 && value.enabled === true
      ).length;
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
    (itemId: string | null) => setHovered(new Set(itemId ? [itemId] : [])),
    []
  );

  // Function to toggle the selection of an item
  const onListItemSelected = useCallback((itemId: string) => {
    setSelected((prev) => new Set(prev.has(itemId) ? [] : [itemId]));
  }, []);

  // On map mounted, we listen some events
  useEffect(() => {
    const fnMouseMove = (e: MapLayerMouseEvent) => {
      if (map.current?.getLayer('pathfinding-incompatible-constraints')) {
        const nearestResult = getMapMouseEventNearestFeature(e, {
          layersId: ['pathfinding-incompatible-constraints'],
        });
        if (nearestResult?.feature && nearestResult?.feature.properties.ids) {
          setHovered(new Set(JSON.parse(nearestResult.feature.properties.ids)));
        } else {
          setHovered(new Set([]));
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
          setSelected((prev) => {
            const nextSelected = JSON.parse(nearestResult.feature.properties.ids);
            if (isArray(nextSelected)) {
              if (nextSelected.some((s) => prev.has(s))) {
                return new Set([]);
              }
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
        : {};
    const nextTypes: Record<string, { count: number; enabled: boolean }> = toPairs(data).reduce(
      (acc, [key, value]) => ({ ...acc, [key]: { count: (value ?? []).length, enabled: true } }),
      {}
    );
    setTypes(nextTypes);

    const turfLength = pathProperties?.geometry
      ? length(feature(pathProperties?.geometry as LineString), { units: 'millimeters' })
      : 0;
    const ratio = turfLength / (pathProperties?.length || turfLength);
    const nextConstraints = toPairs(data)
      .filter(([, value]) => !isNil(value))
      .map(([key, value]) =>
        (value ?? []).map((e) => {
          const id = `${key}-${e.range.start}-${e.range.end}`;
          return {
            id,
            type: key,
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
    setSelected(new Set([]));
    setHovered(new Set([]));
  }, [pathProperties?.incompatibleConstraints]);

  const filteredConstraint = useMemo(
    () => constraints.filter((c) => types[c.type]?.enabled),
    [constraints, types]
  );

  const filteredGeojson = useMemo(() => {
    if (!pathProperties?.geometry || filteredConstraint.length === 0)
      return featureCollection<LineString, { ids: string[] }>([]);
    return getSegmentsConstraints(pathProperties?.geometry as LineString, filteredConstraint);
  }, [pathProperties?.geometry, filteredConstraint]);

  if (total === 0) return null;
  return (
    <>
      <Collapsable
        collapsed={false}
        style={{
          zIndex: 2,
          position: 'absolute',
          bottom: '2em',
          right: '1em',
          backgroundColor: 'rgba(255,255,255,0.9)',
        }}
        className="rounded"
      >
        <>
          <div className="d-flex justify-content-between">
            <h5 className="flex-grow-1 mb-0">
              {filteredConstraint.length !== total
                ? t('incompatibleConstraints.title_on', { count: filteredConstraint.length, total })
                : t('incompatibleConstraints.title', { total })}
            </h5>
            <IncompatibleConstraintsInfo className="flex-grow-0 mx-2" />
            <IncompatibleConstraintsMapFocus geojson={filteredGeojson} />
          </div>
          <IncompatibleConstraintsFilters
            className="d-flex align-self-center"
            data={types}
            toggle={toggleType}
          />
        </>
        <div
          className="mt-2 pr-2"
          style={{ maxHeight: '30vh', maxWidth: '30vw', overflow: 'auto' }}
        >
          <IncompatibleConstraintsList
            data={filteredConstraint}
            hovered={hovered}
            selected={selected}
            onHover={onListItemHover}
            onSelect={onListItemSelected}
          />
        </div>
      </Collapsable>
      {pathProperties?.geometry && (
        <IncompatibleConstraintsLayer
          data={filteredGeojson}
          hovered={hovered}
          selected={selected}
        />
      )}
    </>
  );
};

export default IncompatibleConstraints;
