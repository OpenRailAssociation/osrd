import { useMemo } from 'react';

import { ComboBox, Select } from '@osrd-project/ui-core';
import { AddedLocation, AddLocation, FocusLocation } from '@osrd-project/ui-icons';
import bbox from '@turf/bbox';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';

import type { CategoryColors } from 'applications/operationalStudies/types';
import { computeBBoxViewport } from 'common/Map/WarpedMap/core/helpers';
import { useMapSettings, useMapSettingsActions } from 'reducers/commonMap';
import type { Viewport } from 'reducers/commonMap/types';
import type { PathStepMetadata, PathStepV2 } from 'reducers/osrdconf/types';
import { useAppDispatch } from 'store';

import { computePathStepCoordinates, isOpRefMetadata } from './utils';

const EMPTY_OPTION = { label: '', id: '' };

type PathStepProps = {
  pathStep?: PathStepV2;
  pathStepMetadata?: PathStepMetadata;
  index?: number;
  hidePathfindingLine?: boolean;
  categoryColors: CategoryColors;
};

const PathStepItem = ({
  pathStep,
  pathStepMetadata,
  index,
  hidePathfindingLine,
  categoryColors,
}: PathStepProps) => {
  const { t } = useTranslation('operational-studies', {
    keyPrefix: 'manageTimetableItem.itineraryModal',
  });
  const dispatch = useAppDispatch();
  const mapSettings = useMapSettings();
  const { updateViewport } = useMapSettingsActions();

  const secondaryCodeSuggestions = useMemo(() => {
    if (!isOpRefMetadata(pathStepMetadata)) return [];
    return [
      { label: '', id: '' },
      ...Array.from(pathStepMetadata.locationsBySecondaryCode.keys()).map((key) => ({
        label: key,
        id: key,
      })),
    ];
  }, [pathStepMetadata]);

  const selectedSecondaryCodeOption = useMemo(() => {
    if (!isOpRefMetadata(pathStepMetadata)) return { label: '', id: '' };

    return {
      label: pathStepMetadata?.secondaryCode ?? '',
      id: pathStepMetadata?.secondaryCode ?? '',
    };
  }, [pathStep, pathStepMetadata]);

  const trackNameSuggestions = useMemo(() => {
    const selectedSecondaryCode = selectedSecondaryCodeOption.id;
    if (!selectedSecondaryCode) return [];

    const selectedSecondaryCodeLocations =
      (isOpRefMetadata(pathStepMetadata) &&
        pathStepMetadata.locationsBySecondaryCode.get(selectedSecondaryCode)) ||
      [];

    const sortedSuggestions = selectedSecondaryCodeLocations
      .map((location, i) => ({
        label: location.trackName,
        id: `${location.trackId}-${i}`,
      }))
      // Sort with numbers first in ascending order, then alphabetically
      .sort((a, b) => {
        const isANumber = !isNaN(Number(a.label));
        const isBNumber = !isNaN(Number(b.label));

        if (isANumber && isBNumber) {
          return parseInt(a.label) - parseInt(b.label);
        } else if (isANumber) {
          return -1;
        } else if (isBNumber) {
          return 1;
        } else {
          return a.label.localeCompare(b.label);
        }
      });
    return [{ label: '', id: '' }, ...sortedSuggestions];
  }, [pathStepMetadata, selectedSecondaryCodeOption]);

  const selectedTrackNameOption = useMemo(() => {
    // No track should be selected if the path step is invalid or has no secondary code
    // or is a step added by map click

    if (!isOpRefMetadata(pathStepMetadata) || !pathStepMetadata.trackName) {
      return EMPTY_OPTION;
    }

    return (
      trackNameSuggestions.find((track) => track.label === pathStepMetadata.trackName) ||
      EMPTY_OPTION
    );
  }, [pathStep, pathStepMetadata]);

  const handleFocusClick = () => {
    if (!pathStepMetadata) return;

    const coordinates = computePathStepCoordinates(pathStepMetadata);
    let viewport: Partial<Viewport> = mapSettings.viewport;
    if (coordinates.length === 1) {
      viewport = {
        longitude: coordinates[0][0],
        latitude: coordinates[0][1],
      };
    } else {
      const box = bbox({
        type: 'MultiPoint',
        coordinates,
      });
      viewport = computeBBoxViewport(box, mapSettings.viewport);
    }
    dispatch(updateViewport(viewport));
  };

  return (
    <div className="path-step-wrapper">
      <div
        className={cx('path-step', {
          'requested-point': pathStep?.location && 'track' in pathStep.location,
        })}
      >
        <div
          className={cx('path-step-counter', {
            index,
            'pathfinding-line': !hidePathfindingLine,
            origin: index === 1,
            empty: !pathStep,
          })}
          style={{
            borderColor: index ? categoryColors.background : categoryColors.normal,
            // @ts-expect-error: variable CSS custom property to be used to style ::before
            '--pathBackground': categoryColors.normal,
          }}
        >
          {index}
        </div>
        <div className="path-step-op-name">
          <ComboBox
            id={`pathStep-name-${pathStep?.id ?? 'empty'}`}
            value={isOpRefMetadata(pathStepMetadata) ? pathStepMetadata.name : ''}
            suggestions={[]}
            getSuggestionLabel={(option) => String(option)}
            onSelectSuggestion={() => {}}
            resetSuggestions={() => {}}
            small
            narrow
            readOnly
          />
        </div>
        {pathStep?.location && 'track' in pathStep.location ? (
          <div className="requested-point-block" />
        ) : (
          <>
            <Select
              id={`pathStep-type-${pathStep?.id ?? 'empty'}`}
              value={selectedSecondaryCodeOption}
              options={secondaryCodeSuggestions}
              getOptionLabel={(option) => option.label}
              getOptionValue={(option) => option.id}
              onChange={() => {}}
              small
              narrow
              readOnly
            />
            <Select
              id={`pathStep-status-${pathStep?.id ?? 'empty'}`}
              value={selectedTrackNameOption}
              options={trackNameSuggestions}
              getOptionLabel={(option) => option.label}
              getOptionValue={(option) => option.id}
              onChange={() => {}}
              small
              narrow
              readOnly
            />
          </>
        )}
        <div className="map-interactions">
          {pathStep?.location && 'track' in pathStep.location ? (
            <AddedLocation
              size="lg"
              variant="fill"
              className="added-location-icon"
              title={t('moveLocationOnMap')}
              aria-label={t('moveLocationOnMap')}
            />
          ) : (
            <AddLocation
              size="lg"
              title={t('addLocationOnMap')}
              aria-label={t('addLocationOnMap')}
            />
          )}
          <button
            className={cx('focus-map-icon', { empty: !pathStep })}
            disabled={!pathStep}
            onClick={handleFocusClick}
          >
            <FocusLocation
              size="lg"
              title={t('focusLocationOnMap')}
              aria-label={t('focusLocationOnMap')}
            />
          </button>
        </div>
      </div>
    </div>
  );
};

export default PathStepItem;
