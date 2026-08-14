import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { useTranslation } from 'react-i18next';

import useScenario from 'applications/operationalStudies/hooks/useScenario';
import OSRDTooltip from 'common/OSRDTooltip';
import { useSubCategoryContext } from 'common/SubCategoryContext';
import isMainCategory from 'modules/rollingStock/helpers/category';
import { useDateTimeLocale } from 'utils/date';

import type { ConflictWithTrainNames } from '../types';
import { getTrainCategoryClassName } from './../../../applications/operationalStudies/views/Scenario/components/Timetable/utils';

const MAX_TAG_ROWS = 2;
const TRAIN_NAME_TAG_GAP = 4; // must match .trains-name --tag-gap in SCSS
const OTHER_TAG_WIDTH = 36; // width for "+NN" tag (3ch + padding)

// Format a positive duration in milliseconds as a signed `hh:mm` string.
const formatHm = (ms: number): string => {
  const totalMinutes = Math.floor(ms / 60_000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

const fitsWithinRows = (widths: number[], availableWidth: number, gap: number) => {
  let rows = 1;
  let rowWidth = 0;

  for (const width of widths) {
    if (width > availableWidth) return false;

    if (rowWidth === 0) {
      rowWidth = width;
      continue;
    }

    if (rowWidth + gap + width <= availableWidth) {
      rowWidth += gap + width;
      continue;
    }

    rows += 1;
    if (rows > MAX_TAG_ROWS) return false;
    rowWidth = width;
  }

  return true;
};

const ConflictCard = ({ conflict }: { conflict: ConflictWithTrainNames }) => {
  const { t } = useTranslation('operational-studies', { keyPrefix: 'main' });
  const dateTimeLocale = useDateTimeLocale();
  const { scenario: { timetable_type: timetableType } = {} } = useScenario();
  const isHourly = timetableType === 'HOURLY';
  const start_time = isHourly
    ? formatHm(conflict.start_time)
    : new Date(conflict.start_time).toLocaleTimeString(dateTimeLocale);
  const end_time = isHourly
    ? formatHm(conflict.duration)
    : new Date(conflict.start_time + conflict.duration).toLocaleTimeString(dateTimeLocale);
  const start_date = new Date(conflict.start_time).toLocaleDateString(dateTimeLocale);
  const totalTrains = conflict.trainsData.length;

  const [isOthersTooltipOpen, setIsOthersTooltipOpen] = useState(false);
  const [visibleTrainCount, setVisibleTrainCount] = useState(totalTrains);
  const [containerWidth, setContainerWidth] = useState(0);

  const subCategories = useSubCategoryContext();

  const trainsContainerRef = useRef<HTMLDivElement>(null);
  const othersTagRef = useRef<HTMLDivElement>(null);
  const trainRefs = useRef<(HTMLDivElement | null)[]>([]);
  const trainWidthsRef = useRef<number[]>([]);

  trainRefs.current.length = totalTrains;

  const showOthers = visibleTrainCount < totalTrains;
  const hiddenTrains = useMemo(
    () => (showOthers ? conflict.trainsData.slice(visibleTrainCount) : []),
    [conflict.trainsData, showOthers, visibleTrainCount]
  );

  useEffect(() => {
    const container = trainsContainerRef.current;
    if (!container) return undefined;

    const resizeObserver = new ResizeObserver(([entry]) => {
      const width = Math.round(entry.contentRect.width);
      setContainerWidth((previous) => (Math.abs(previous - width) < 1 ? previous : width));
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  useLayoutEffect(() => {
    const container = trainsContainerRef.current;
    if (!container || totalTrains === 0) return;

    if (containerWidth === 0) {
      const initialWidth = Math.round(container.getBoundingClientRect().width);
      setContainerWidth(initialWidth);
      return;
    }

    if (trainWidthsRef.current.length !== totalTrains) {
      const widths = Array.from(
        { length: totalTrains },
        (_, index) => trainRefs.current[index]?.offsetWidth ?? 0
      );
      trainWidthsRef.current = widths;
    }

    const trainWidths = trainWidthsRef.current;
    if (!trainWidths.length) return;

    let nextVisibleCount = trainWidths.length;

    if (!fitsWithinRows(trainWidths, containerWidth, TRAIN_NAME_TAG_GAP)) {
      nextVisibleCount = 0;
      for (let count = trainWidths.length - 1; count >= 0; count -= 1) {
        const othersWidth = OTHER_TAG_WIDTH;
        if (!othersWidth) continue;

        const widthsToFit = [...trainWidths.slice(0, count), othersWidth];
        if (fitsWithinRows(widthsToFit, containerWidth, TRAIN_NAME_TAG_GAP)) {
          nextVisibleCount = count;
          break;
        }
      }
    }

    if (nextVisibleCount !== visibleTrainCount) {
      setVisibleTrainCount(nextVisibleCount);
    }
  }, [containerWidth, totalTrains, visibleTrainCount]);

  return (
    <div className="conflict-card">
      <div className="conflict-info">
        <div className="conflict-type">{t(conflict.conflict_type)}</div>
        <div className="start-and-end-time">
          <div className="start-time" title={start_time}>
            {start_time}
          </div>
          <div className="end-time" title={end_time}>
            {end_time}
          </div>
        </div>
        {!isHourly && (
          <div className="departure-date" title={start_date}>
            {start_date}
          </div>
        )}
      </div>

      <div className="trains-name" ref={trainsContainerRef}>
        {conflict.trainsData.map((train, idx) => {
          if (idx >= visibleTrainCount) return null;
          const category = train.category;

          const currentSubCategory =
            category && !isMainCategory(category)
              ? subCategories?.find((opt) => opt.code === category.sub_category_code)
              : null;

          return (
            <div
              key={`train-${idx}-${train.name}`}
              className={`train-name-card ${getTrainCategoryClassName(category, 'text')}`}
              ref={(element) => {
                trainRefs.current[idx] = element;
              }}
              style={{
                color: currentSubCategory?.color,
              }}
              title={train.name}
            >
              <span>{train.name}</span>
            </div>
          );
        })}

        {showOthers && (
          <>
            <div
              ref={othersTagRef}
              className="train-name-card train-category-text-None other-trains"
              onMouseEnter={() => setIsOthersTooltipOpen(true)}
              onMouseLeave={() => setIsOthersTooltipOpen(false)}
            >
              <span>{t('conflicts.otherTrains', { count: hiddenTrains.length })}</span>
            </div>

            {isOthersTooltipOpen && (
              <OSRDTooltip
                containerRef={othersTagRef}
                header={t('conflicts.trainsInConflictTitle')}
                items={hiddenTrains.map((train) => train.name)}
                offsetRatio={{ top: 1.2 }}
                reverseIfOverflow
              />
            )}
          </>
        )}
      </div>

      <div className="conflict-separator" />
      <div className="conflict-separator-bottom" />
    </div>
  );
};

export default ConflictCard;
