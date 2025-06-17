/* eslint-disable no-nested-ternary */
import { useLayoutEffect, useRef, useState } from 'react';

import cx from 'classnames';
import { isEmpty } from 'lodash';
import { useTranslation } from 'react-i18next';

import { getExceptionType } from 'utils/trainId';

import { TRAIN_CATEGORY_CLASS } from '../consts';
import type { Occurrence } from '../types';

type OccurrenceIndicatorProps = {
  occurrence: Occurrence;
};

const TOOLTIP_BOTTOM_MARGIN = 24;

/**
 * The bullet that marks each item of the list of occurrences, with its tooltip.
 */
const OccurrenceIndicator = ({ occurrence }: OccurrenceIndicatorProps) => {
  const { t } = useTranslation(['operational-studies', 'translation'], {
    keyPrefix: 'main.timetable',
  });
  const dotRef = useRef<HTMLDivElement>(null);
  const changeGroupsRef = useRef<HTMLDivElement>(null);

  const [isHovering, setIsHovering] = useState(false);
  const [position, setPosition] = useState<{
    top?: number;
    left: number;
    bottom?: number;
  } | null>(null);

  const exceptionType = getExceptionType(occurrence);

  useLayoutEffect(() => {
    if (!dotRef.current || !isHovering) return;

    const rect = dotRef.current.getBoundingClientRect();
    const changeGroupsRect = changeGroupsRef.current?.getBoundingClientRect();

    const wouldOverflowBottom =
      changeGroupsRect &&
      rect.bottom + changeGroupsRect?.height + TOOLTIP_BOTTOM_MARGIN > window.innerHeight;

    const tooltipLeftPosition = rect.left + window.scrollX + rect.width;

    if (wouldOverflowBottom) {
      setPosition({
        left: tooltipLeftPosition,
        top: undefined,
        bottom: TOOLTIP_BOTTOM_MARGIN,
      });
      return;
    }

    // no overflow
    setPosition({
      top: rect.top + window.scrollY + rect.height / 2,
      left: tooltipLeftPosition,
      bottom: undefined,
    });
  }, [isHovering]);

  const displayedChangeGroups =
    occurrence.exceptionChangeGroups &&
    Object.entries(occurrence.exceptionChangeGroups)
      .filter(([_, isPresent]) => isPresent !== null)
      .map(([changeGroup], i) => (
        <span key={i} className="change-group">
          {changeGroup !== 'rolling_stock_category'
            ? t(`occurrenceChangeGroup.${changeGroup}`)
            : t(
                `rollingStock.categoriesOptions.${occurrence.exceptionChangeGroups?.rolling_stock_category?.value ?? 'noCategory'}`,
                { ns: 'translation', keyPrefix: '' }
              )}
        </span>
      ));
  return (
    <div
      data-testid="occurrence-indicator"
      className="occurrence-indicator"
      ref={dotRef}
      onMouseEnter={() => {
        setPosition(null);
        setIsHovering(true);
      }}
      onMouseLeave={() => {
        setPosition(null);
        setIsHovering(false);
      }}
    >
      {isHovering && (occurrence.disabled || !isEmpty(occurrence.exceptionChangeGroups)) && (
        <div
          data-testid="exception-info"
          className="exception-info"
          style={{
            top: position?.top ? position.top - window.scrollY : undefined,
            left: position?.left ? position.left - window.scrollX : undefined,
            bottom: position?.bottom ? position.bottom - window.scrollY : undefined,
          }}
        >
          <div ref={changeGroupsRef}>
            <span className="exception-type">
              {occurrence.disabled
                ? t('occurrenceType.disabledOccurrence')
                : exceptionType === 'modified'
                  ? t('occurrenceType.editedOccurrence')
                  : t('occurrenceType.addedOccurrence')}
            </span>
            <hr />
            <div className="change-groups">{displayedChangeGroups}</div>
          </div>
        </div>
      )}
      <span
        className={cx(
          'icon',
          `train-category-bg-${TRAIN_CATEGORY_CLASS[occurrence.category ?? 'None']}`,
          {
            exception: !isEmpty(occurrence.exceptionChangeGroups),
            disabled: occurrence.disabled,
          }
        )}
      />
    </div>
  );
};

export default OccurrenceIndicator;
