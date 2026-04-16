import { useMemo } from 'react';

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
  onOpClear: () => void;
  isTrailingPlaceHolder: boolean;
  isOnlyStep: boolean;
  isMapSelectionMode?: boolean;
  isDestination?: boolean;
  onStartMapSelection?: () => void;
  onCancelMapSelection?: () => void;
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
  onOpClear,
  isTrailingPlaceHolder,
  isOnlyStep,
  isMapSelectionMode,
  isDestination,
  onStartMapSelection,
  onCancelMapSelection,
}: PathStepProps) => {
  const { t } = useTranslation('operational-studies', {
    keyPrefix: 'manageTimetableItem.itineraryModal',
  });
  const { t: tMain } = useTranslation('operational-studies', { keyPrefix: 'main' });
  const dispatch = useAppDispatch();
  const mapSettings = useMapSettings();
  const { updateViewport } = useMapSettingsActions();

  const blurActiveElement = () => {
    requestAnimationFrame(() => {
      (document.activeElement as HTMLElement | null)?.blur();
    });
  };
  const isIndexed = !isTrailingPlaceHolder;

  const shouldShowInvalidMessage = !!isInvalidAndIsEditing && !isMapSelectionMode;

  const getInvalidMessage = () => {
    let message = t('invalidOP');

    const { location } = pathStep;

    if (location?.type === 'track_offset') {
      return (message += t('requestedPoint'));
    }

    const trackInfo =
      location && location.local_track_name ? `, ${t('track')} ${location.local_track_name}` : '';

    if (location?.operational_point.type === 'id') {
      return (message += t('opId') + trackInfo);
    }

    const secondaryCodeInfo =
      pathStepMetadata && isOpRefMetadata(pathStepMetadata) && pathStepMetadata.secondaryCode
        ? `/${pathStepMetadata.secondaryCode}`
        : '';

    if (location?.operational_point.type === 'trigram') {
      message += t('trigram') + ' ' + location.operational_point.trigram;
    }

    if (location?.operational_point.type === 'uic') {
      message += t('uic') + ' ' + location.operational_point.uic;
    }

    return message + secondaryCodeInfo + trackInfo;
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
  }, [pathStepMetadata, selectedSecondaryCodeOption.id]);

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

  const canFocusOnMap = useMemo(() => {
    if (!pathStepMetadata) return false;
    const coordinates = computePathStepCoordinates(pathStepMetadata);
    return coordinates.length > 0;
  }, [pathStepMetadata]);

  const handleFocusClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!pathStepMetadata) return;

    const coordinates = computePathStepCoordinates(pathStepMetadata);
    if (coordinates.length === 0) return;
    const viewport =
      coordinates.length === 1
        ? { longitude: coordinates[0][0], latitude: coordinates[0][1], zoom: 16 }
        : computeBBoxViewport(bbox({ type: 'MultiPoint', coordinates }), mapSettings.viewport);
    if (viewport) dispatch(updateViewport(viewport));
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
  const isTrackOffset = !!(pathStep?.location && pathStep.location.type === 'track_offset');

  const trackOffsetLabel = useMemo(() => {
    if (!isTrackOffset) return '';
    if (index === 1) return tMain('requestedOrigin');
    if (isDestination) return tMain('requestedDestination');
    return tMain('requestedPoint', { count: index });
  }, [isTrackOffset, index, isDestination, tMain]);

  const comboBoxValue = useMemo(() => {
    if (isTrackOffset) return trackOffsetLabel;
    // Don't show invalid points in the combobox - they'll be shown in the error message instead
    if (shouldShowInvalidMessage) {
      return '';
    }

    if (inputValue !== undefined) return inputValue;

    if (isOpRefMetadata(pathStepMetadata)) {
      return `${pathStepMetadata.name} ${pathStepMetadata.secondaryCode}`;
    }

    return undefined;
  }, [inputValue, pathStepMetadata, isTrackOffset, trackOffsetLabel, shouldShowInvalidMessage]);

  const maxVisibleSuggestions = 8;
  const visibleSuggestions = opSuggestions.slice(0, maxVisibleSuggestions);
  const hasMore = opSuggestions.length > maxVisibleSuggestions;
  const numberOfSuggestionsToShow = hasMore
    ? visibleSuggestions.length + 1
    : visibleSuggestions.length;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Enter') return;

    const activeSuggestion = e.currentTarget.querySelector('.suggestion-item.active');
    if (activeSuggestion) return;

    e.preventDefault();
    e.stopPropagation();

    const firstSuggestion = visibleSuggestions[0];

    if (!firstSuggestion) {
      onOpInputChange('');
      resetOpSuggestions();
      blurActiveElement();
      return;
    }

    if (firstSuggestion && typeof firstSuggestion !== 'string') {
      const defaultSecondaryCode =
        firstSuggestion.secondaryCodeList.find((sc) => sc.isBestSuggestion)?.code ??
        firstSuggestion.secondaryCodeList[0]?.code;

      onSelectOpSuggestion(firstSuggestion, defaultSecondaryCode);
      resetOpSuggestions();
      blurActiveElement();
      return;
    }

    resetOpSuggestions();
    blurActiveElement();
  };

  return (
    <div
      className={cx('path-step-wrapper', {
        'is-placeholder': isTrailingPlaceHolder,
        'map-selection-active': isMapSelectionMode,
      })}
    >
      <div
        className={cx('path-step', {
          'requested-point': isTrackOffset,
          'map-selection-mode': isMapSelectionMode,
        })}
      >
        <button
          type="button"
          className={cx('path-step-counter', {
            invalid: isInvalidAndIsEditing,
            'is-only-step': isOnlyStep,
            'is-trailing-placeholder': isTrailingPlaceHolder,
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
        >
          <span className="counter">{!isTrailingPlaceHolder && index}</span>
          {!isOnlyStep && (
            <span className="remove-path-step-icon">
              <X />
            </span>
          )}
        </button>

        {isMapSelectionMode ? (
          <div className="map-selection-message">
            <span className="map-selection-text">
              {t(pathStep.location ? 'movePointOnMap' : 'addPointOnMap')}
            </span>
            <button
              type="button"
              className="cancel-map-selection-button"
              onClick={(e) => {
                e.stopPropagation();
                onCancelMapSelection?.();
              }}
            >
              {t('cancelMapSelection')}
            </button>
          </div>
        ) : (
          <>
            <div
              role="button"
              tabIndex={0}
              className={cx('path-step-op-name', {
                invalid: isInvalidAndIsEditing,
              })}
              onKeyDownCapture={handleKeyDown}
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

                  const secondaryCode = op.secondaryCodeList[0]?.code;
                  return `${op.name} ${secondaryCode}`;
                }}
                onSelectSuggestion={(op) => {
                  if (!op) {
                    onOpClear();
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
                onFocusCapture={onOpFocus}
                onBlurCapture={onOpBlur}
                onChange={(e) => onOpInputChange(e.target.value)}
              />
            </div>
            {isTrackOffset ? (
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
          </>
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
          <button
            type="button"
            className={cx('select-location-button', { active: isMapSelectionMode })}
            disabled={!pathStep}
            onClick={(e) => {
              e.stopPropagation();
              if (isMapSelectionMode) {
                onCancelMapSelection?.();
              } else {
                onStartMapSelection?.();
              }
            }}
          >
            {isTrackOffset ? (
              <AddedLocation
                size="lg"
                variant={isMapSelectionMode ? 'fill' : undefined}
                className={isMapSelectionMode ? 'location-icon' : undefined}
                title={t('moveLocationOnMap')}
                aria-label={t('moveLocationOnMap')}
              />
            ) : (
              <AddLocation
                size="lg"
                variant={isMapSelectionMode ? 'fill' : undefined}
                className={isMapSelectionMode ? 'location-icon' : undefined}
                title={t('addLocationOnMap')}
                aria-label={t('addLocationOnMap')}
              />
            )}
          </button>
          <button
            className={cx('focus-map-icon', { empty: !canFocusOnMap })}
            disabled={!canFocusOnMap}
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
