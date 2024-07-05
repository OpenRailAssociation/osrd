import React, { type FC, useEffect, useMemo, useState, useCallback } from 'react';

import lineSliceAlong from '@turf/line-slice-along';
import type { LineString } from 'geojson';
import { isNil, sum, toPairs } from 'lodash';
import { useTranslation } from 'react-i18next';

import type { ManageTrainSchedulePathProperties } from 'applications/operationalStudies/types';
import Collapsable from 'common/Collapsable';

import IncompatibleConstraintsFilters from './IncompatibleConstrainstFilters';
import IncompatibleConstraintsInfo from './IncompatibleConstrainstInfo';
import IncompatibleConstraintsLayer from './IncompatibleConstraintsLayer';
import IncompatibleConstraintsList from './IncompatibleConstraintsList';
import IncompatibleConstraintsShowFullPath from './IncompatibleConstraintsShowFullPath';

interface IncompatibleConstraintsProps {
  pathProperties?: ManageTrainSchedulePathProperties;
}
const IncompatibleConstraints: FC<IncompatibleConstraintsProps> = ({ pathProperties }) => {
  const { t } = useTranslation(['operationalStudies/manageTrainSchedule']);
  const [types, setTypes] = useState<Record<string, { count: number; enabled: boolean }>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set([]));

  // When pathProperties changes
  //  => recompute types with their count.
  //  => reset selected
  useEffect(() => {
    const data = pathProperties?.incompatibleConstraints || {};
    setTypes(
      toPairs(data).reduce(
        (acc, [key, value]) => ({ ...acc, [key]: { count: (value ?? []).length, enabled: true } }),
        {}
      )
    );
    setSelected(new Set([]));
  }, [pathProperties?.incompatibleConstraints]);

  // Keep track of the total number of incompatible constraints
  const total = useMemo(() => sum(toPairs(types).map(([, type]) => type.count)), [types]);

  // When pathProperties or types changes => recompute the data to display
  const list = useMemo(() => {
    const data = pathProperties?.incompatibleConstraints || {};
    return toPairs(data)
      .filter(([key, value]) => types[key]?.enabled && !isNil(value))
      .map(([key, value]) =>
        (value ?? []).map((e) => {
          const id = `${key}-${e.range.start}-${e.range.end}`;
          const enhancedValue = {
            ...e,
            id,
            type: key,
            highlighted: selected.has(id),
          };
          return {
            ...enhancedValue,
            geometry: {
              ...lineSliceAlong(
                pathProperties?.geometry as LineString,
                e.range.start,
                e.range.end,
                {
                  units: 'millimeters',
                }
              ),
              properties: enhancedValue,
            },
          };
        })
      )
      .flat();
  }, [pathProperties?.incompatibleConstraints, pathProperties?.geometry, types, selected]);

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

  if (total === 0) return null;
  return (
    <>
      <Collapsable
        collapsed={false}
        style={{
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
              {list.length !== total
                ? t('incompatibleConstraints.title_on', { count: list.length, total })
                : t('incompatibleConstraints.title', { total })}
            </h5>
            <IncompatibleConstraintsInfo className="flex-grow-0 mx-2" />
            <IncompatibleConstraintsShowFullPath path={pathProperties?.geometry} />
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
            data={list}
            onHover={() => {}}
            onClick={(item) =>
              setSelected((prev) => {
                const result = new Set(prev.values());
                if (result.has(item.id)) {
                  result.delete(item.id);
                } else {
                  result.add(item.id);
                }
                return result;
              })
            }
          />
        </div>
      </Collapsable>
      {pathProperties?.geometry && <IncompatibleConstraintsLayer data={list} />}
    </>
  );
};

export default IncompatibleConstraints;
