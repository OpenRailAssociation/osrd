import { useMemo, useState } from 'react';

import { ComboBox, Select, SegmentedControl } from '@osrd-project/ui-core';
import {
  AddedLocation,
  AddLocation,
  FocusLocation,
  ArrowRight,
  Square,
  KebabHorizontal,
  X,
} from '@osrd-project/ui-icons';
import bbox from '@turf/bbox';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';

import type { CategoryColors } from 'applications/operationalStudies/types';
import { computeBBoxViewport } from 'common/Map/WarpedMap/core/helpers';
import { useMapSettings, useMapSettingsActions } from 'reducers/commonMap';
import type { Viewport } from 'reducers/commonMap/types';
import type { PathStepMetadata, PathStepV2 } from 'reducers/osrdconf/types';
import { useAppDispatch } from 'store';
import { Duration } from 'utils/duration';

import {
  ListElementComponent,
  type OperationalPointSuggestion,
} from './ComboBoxCustomList/ListElementComponent';
import { computePathStepCoordinates, isOpRefMetadata } from './utils';

const EMPTY_OPTION = { label: '', id: '' };

type PathStepProps = {
  pathStep: PathStepV2;
  setPathSteps?: React.Dispatch<React.SetStateAction<PathStepV2[]>>;
  pathStepMetadata: PathStepMetadata | undefined;
  index: number;
  hidePathfindingLine: boolean;
  categoryColors: CategoryColors;
  onOpInputChange: (value: string) => void;
  onTrackNameChange: (trackName: string) => void;
  onOpFocus: () => void;
  onOpBlur: () => void;
  inputValue: string | undefined;
  opSuggestions: Array<OperationalPointSuggestion | string>;
  onSelectOpSuggestion: (suggestion: OperationalPointSuggestion, secondaryCode?: string) => void;
  resetOpSuggestions: () => void;
  onChevronClick: (queryValue: string) => void;
  isInvalidAndIsEditing: boolean;
  connectorLong: boolean;
  onDelete: () => void;
  isTrailingPlaceHolder: boolean;
  isOnlyStep: boolean;
};

const PathStepItem = ({
  pathStep,
  setPathSteps,
  pathStepMetadata,
  index,
  hidePathfindingLine,
  categoryColors,
  onOpInputChange,
  onTrackNameChange,
  onOpFocus,
  onOpBlur,
  inputValue,
  opSuggestions,
  onSelectOpSuggestion,
  resetOpSuggestions,
  onChevronClick,
  isInvalidAndIsEditing,
  connectorLong,
  onDelete,
  isTrailingPlaceHolder,
  isOnlyStep,
}: PathStepProps) => {
  const { t } = useTranslation('operational-studies', {
    keyPrefix: 'manageTimetableItem.itineraryModal',
  });
  const dispatch = useAppDispatch();
  const mapSettings = useMapSettings();
  const { updateViewport } = useMapSettingsActions();

  const [hovered, setHovered] = useState(false);

  const blurActiveElement = () => {
    requestAnimationFrame(() => {
      (document.activeElement as HTMLElement | null)?.blur();
    });
  };
  const isIndexed = !isTrailingPlaceHolder;

  const shouldShowInvalidMessage = !!isInvalidAndIsEditing;

  const getInvalidMessage = () => {
    let message = t('invalidOP');

    if (!pathStepMetadata?.isInvalid || !pathStep.location || inputValue !== undefined)
      return (message += `${inputValue}
      `);

    const { location } = pathStep;

    if ('track' in location) {
      return (message += t('requestedPoint'));
    }

    const trackInfo = location.local_track_name
      ? `, ${t('track')} ${location.local_track_name}`
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
  }, [pathStepMetadata]);

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
  }, [pathStepMetadata, trackNameSuggestions]);

  const handleFocusClick = () => {
    if (!pathStepMetadata) return;

    const coordinates = computePathStepCoordinates(pathStepMetadata);
    let viewport: Partial<Viewport> = mapSettings.viewport;
    if (coordinates.length === 1) {
      viewport = {
        longitude: coordinates[0][0],
        latitude: coordinates[0][1],
        zoom: 16,
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

  type SegmentedControlOption = { value: string; label: string; icon: React.ReactNode };

  const segmentedControlOptions: SegmentedControlOption[] = [
    { value: 'pass', label: t('pass'), icon: <ArrowRight size="sm" /> },
    { value: 'stop', label: t('stop'), icon: <Square size="sm" variant="fill" /> },
  ];

  const toggleType = (option: { value: string; label: string }) => {
    if (!pathStep || !setPathSteps || index === undefined) return;
    const newPathStep = { ...pathStep };
    if (option.value === 'stop') {
      newPathStep.stopFor = new Duration({ minutes: 0 });
    } else {
      newPathStep.stopFor = null;
    }
    setPathSteps((prevSteps) => {
      const updatedSteps = [...prevSteps];
      updatedSteps[index - 1] = newPathStep;
      return updatedSteps;
    });
  };

  const comboBoxValue = useMemo(() => {
    // Don't show invalid points in the combobox - they'll be shown in the error message instead
    if (inputValue !== undefined && pathStepMetadata?.isInvalid) return undefined;

    if (inputValue !== undefined) return inputValue;

    if (isOpRefMetadata(pathStepMetadata)) {
      return `${pathStepMetadata.name} ${pathStepMetadata.secondaryCode}`;
    }

    return undefined;
  }, [inputValue, pathStepMetadata]);

  const maxVisibleSuggestions = 8;
  const visibleSuggestions = opSuggestions.slice(0, maxVisibleSuggestions);
  const hasMore = opSuggestions.length > maxVisibleSuggestions;
  const numberOfSuggestionsToShow = hasMore
    ? visibleSuggestions.length + 1
    : visibleSuggestions.length;

  return (
    <div className={cx('path-step-wrapper', { 'is-placeholder': isTrailingPlaceHolder })}>
      <div
        className={cx('path-step', {
          'requested-point': pathStep.location && 'track' in pathStep.location,
        })}
      >
        <button
          type="button"
          className={cx('path-step-counter', {
            'delete-hovered': hovered && !isTrailingPlaceHolder && !isOnlyStep,
            invalid: isInvalidAndIsEditing,
            'is-only-step': isOnlyStep,
            index: isIndexed,
            'pathfinding-line': !hidePathfindingLine,
            origin: index === 1,
            empty: !pathStep.location,
          })}
          style={{
            borderColor: !isInvalidAndIsEditing
              ? isIndexed
                ? categoryColors.background
                : categoryColors.normal
              : '',
            // @ts-expect-error: variable CSS custom property to be used to style ::before
            '--pathBackground': isTrailingPlaceHolder
              ? 'rgba(0, 0, 0, 0.2)'
              : categoryColors.normal,
            '--counterLink': connectorLong ? '48px' : '28px',
          }}
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          onPointerEnter={() => !isTrailingPlaceHolder && setHovered(true)}
          onPointerLeave={() => !isTrailingPlaceHolder && setHovered(false)}
        >
          {isTrailingPlaceHolder ? null : hovered && !isOnlyStep ? <X /> : index}
        </button>

        <div
          role="button"
          tabIndex={0}
          className={cx('path-step-op-name', {
            invalid: isInvalidAndIsEditing,
          })}
          onMouseDownCapture={(e) => {
            const target = e.target as HTMLElement | null;
            if (target?.closest('.chevron-icon')) {
              onChevronClick(comboBoxValue ?? '');
            }
          }}
        >
          <ComboBox
            id={`pathStep-name-${pathStep.id}`}
            value={comboBoxValue}
            numberOfSuggestionsToShow={numberOfSuggestionsToShow}
            suggestions={visibleSuggestions}
            getSuggestionLabel={(op) => {
              if (!op) return '';
              if (typeof op === 'string') return op;
              return `${op.trigram} ${op.name}`;
            }}
            onSelectSuggestion={(op) => {
              if (!op) {
                onOpInputChange('');
                resetOpSuggestions();
                return;
              }

              if (typeof op === 'string') {
                onOpInputChange(op);
                return;
              }

              onSelectOpSuggestion(op);
              resetOpSuggestions();
              blurActiveElement();
            }}
            resetSuggestions={resetOpSuggestions}
            renderListElementComponent={({
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
                  onSelect={(op, secondaryCode) => {
                    onSelectOpSuggestion(op, secondaryCode);
                    resetOpSuggestions();
                    blurActiveElement();
                  }}
                />
              );
            }}
            renderFooterItem={
              hasMore
                ? () => (
                    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
                    <li
                      className="suggestion-item suggestion-item--more"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                    >
                      <span className="op-suggestion-kebab">
                        <KebabHorizontal size="sm" />
                      </span>
                    </li>
                  )
                : undefined
            }
            small
            narrow
            onFocus={onOpFocus}
            onBlur={onOpBlur}
            onChange={(e) => onOpInputChange(e.target.value)}
          />
        </div>
        {pathStep.location && 'track' in pathStep.location ? (
          <div className="requested-point-block" />
        ) : (
          <div
            className={cx('track-name', {
              invalid: isInvalidAndIsEditing,
            })}
          >
            <Select
              id={`pathStep-status-${pathStep.id}`}
              value={selectedTrackNameOption}
              options={trackNameSuggestions}
              getOptionLabel={(option) => option.label}
              getOptionValue={(option) => option.id}
              onChange={(option) => onTrackNameChange(option?.label ?? '')}
              small
              narrow
            />
          </div>
        )}
        <SegmentedControl
          options={segmentedControlOptions}
          getOptionLabel={(option: SegmentedControlOption) => option.label}
          getOptionValue={(option: SegmentedControlOption) => option.value}
          getOptionIcon={(option: SegmentedControlOption) => option.icon}
          value={pathStep?.stopFor ? segmentedControlOptions[1] : segmentedControlOptions[0]}
          onChange={(option) => {
            toggleType(option);
          }}
          small
        />
        <div className="map-interactions">
          {pathStep.location && 'track' in pathStep.location ? (
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
            className={cx('focus-map-icon', { empty: !pathStep.location })}
            disabled={!pathStep.location}
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
      {shouldShowInvalidMessage && (
        <span className="invalid-step-message">{getInvalidMessage()}</span>
      )}
    </div>
  );
};

export default PathStepItem;
