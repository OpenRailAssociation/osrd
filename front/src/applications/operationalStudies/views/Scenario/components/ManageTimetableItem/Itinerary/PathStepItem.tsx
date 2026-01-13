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

import {
  ListElementComponent,
  type OperationalPointSuggestion,
} from './ComboBoxCustomList.tsx/ListElementComponent';
import { computePathStepCoordinates, isOpRefMetadata } from './utils';

const EMPTY_OPTION = { label: '', id: '' };

type PathStepProps = {
  pathStep?: PathStepV2;
  pathStepMetadata?: PathStepMetadata;
  index?: number;
  hidePathfindingLine?: boolean;
  categoryColors: CategoryColors;
  onOpInputChange?: (value: string) => void;
  onOpFocus?: () => void;
  inputValue?: string;
  opSuggestions?: Array<OperationalPointSuggestion | string>;
  onSelectOpSuggestion?: (suggestion: OperationalPointSuggestion, ch?: string) => void;
  resetOpSuggestions?: () => void;
};

const PathStepItem = ({
  pathStep,
  pathStepMetadata,
  index,
  hidePathfindingLine,
  categoryColors,
  onOpInputChange,
  onOpFocus,
  inputValue,
  opSuggestions = [],
  onSelectOpSuggestion,
  resetOpSuggestions,
}: PathStepProps) => {
  const { t } = useTranslation('operational-studies', {
    keyPrefix: 'manageTimetableItem.itineraryModal',
  });
  const dispatch = useAppDispatch();
  const mapSettings = useMapSettings();
  const { updateViewport } = useMapSettingsActions();

  const blurActiveElement = () => {
    requestAnimationFrame(() => {
      (document.activeElement as HTMLElement | null)?.blur();
    });
  };

  const getInvalidMessage = () => {
    let message = t('invalidOP');
    if (!pathStepMetadata?.isInvalid || !pathStep?.location) return message;

    const { location } = pathStep;

    if ('track' in location) {
      return (message += t('requestedPoint'));
    }

    const trackInfo = location.track_reference
      ? 'track_name' in location.track_reference
        ? `, ${t('track')} ${location.track_reference.track_name}`
        : `, ${t('trackId')}`
      : '';

    if (location.operational_point.type === 'id') {
      return (message += t('opId') + trackInfo);
    }

    const secondaryCodeInfo = location.operational_point.secondary_code
      ? `/${location.operational_point.secondary_code}`
      : '';

    if (location.operational_point.type === 'trigram') {
      message += t('trigram') + ' ' + location.operational_point.trigram;
    }

    if (location.operational_point.type === 'uic') {
      message += t('uic') + ' ' + location.operational_point.uic;
    }

    return (message += secondaryCodeInfo + trackInfo);
  };

  const selectedSecondaryCodeOption = useMemo(() => {
    if (!isOpRefMetadata(pathStepMetadata)) return { label: '', id: '' };

    return {
      label: pathStepMetadata?.secondaryCode ?? '',
      id: pathStepMetadata?.secondaryCode ?? '',
    };
  }, [pathStep, pathStepMetadata]);

  const trackNameSuggestions = useMemo(() => {
    const selectedSecondaryCode = selectedSecondaryCodeOption.id;
    if (!selectedSecondaryCode || !isOpRefMetadata(pathStepMetadata)) return [];

    const sortedSuggestions = (pathStepMetadata?.parts || [])
      .map((part, i) => ({
        label: part.trackName,
        id: `${part.trackId}-${i}`,
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

  const comboBoxValue = useMemo(() => {
    const raw = inputValue ?? (isOpRefMetadata(pathStepMetadata) ? pathStepMetadata.name : '');

    const text = (raw ?? '').trim();
    return text.length > 0 ? raw : undefined;
  }, [inputValue, pathStepMetadata]);

  return (
    <div className="path-step-wrapper">
      <div
        className={cx('path-step', {
          'requested-point': pathStep?.location && 'track' in pathStep.location,
        })}
      >
        <div
          className={cx('path-step-counter', {
            invalid: pathStepMetadata?.isInvalid,
            index,
            'pathfinding-line': !hidePathfindingLine,
            origin: index === 1,
            empty: !pathStep,
          })}
          style={{
            borderColor: !pathStepMetadata?.isInvalid
              ? index
                ? categoryColors.background
                : categoryColors.normal
              : '',
            // @ts-expect-error: variable CSS custom property to be used to style ::before
            '--pathBackground': categoryColors.normal,
          }}
        >
          {index}
        </div>
        <div
          className={cx('path-step-op-name', {
            invalid: pathStepMetadata?.isInvalid,
          })}
        >
          <ComboBox
            id={`pathStep-name-${pathStep?.id ?? 'empty'}`}
            value={comboBoxValue}
            suggestions={opSuggestions}
            getSuggestionLabel={(op) => {
              if (!op) return '';
              if (typeof op === 'string') return op;
              return `${op.trigram} ${op.name}`;
            }}
            onSelectSuggestion={(op) => {
              if (!op) {
                onOpInputChange?.('');
                resetOpSuggestions?.();
                return;
              }

              if (typeof op === 'string') {
                onOpInputChange?.(op);
                return;
              }

              onSelectOpSuggestion?.(op);
              resetOpSuggestions?.();
              blurActiveElement();
            }}
            resetSuggestions={() => resetOpSuggestions?.()}
            listElementComponent={({
              suggestion,
              index: suggestionIndex,
              isActive,
              isSelected,
            }) => {
              if (typeof suggestion === 'string') return suggestion;

              return (
                <ListElementComponent
                  suggestion={suggestion}
                  index={suggestionIndex}
                  isActive={isActive}
                  isSelected={isSelected}
                  onSelect={(op, ch) => {
                    onSelectOpSuggestion?.(op, ch);
                    resetOpSuggestions?.();
                    blurActiveElement();
                  }}
                />
              );
            }}
            small
            narrow
            onFocus={onOpFocus}
            onChange={(e) => onOpInputChange?.(e.target.value)}
          />
        </div>
        {pathStep?.location && 'track' in pathStep.location ? (
          <div className="requested-point-block" />
        ) : (
          <div
            className={cx('track-name', {
              invalid: pathStepMetadata?.isInvalid,
            })}
          >
            <Select
              id={`pathStep-status-${pathStep?.id ?? 'empty'}`}
              value={selectedTrackNameOption}
              options={trackNameSuggestions}
              getOptionLabel={(option) => option.label}
              getOptionValue={(option) => option.id}
              onChange={() => {}}
              small
              narrow
            />
          </div>
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
      {pathStepMetadata?.isInvalid && (
        <span className="invalid-step-message">{getInvalidMessage()}</span>
      )}
    </div>
  );
};

export default PathStepItem;
