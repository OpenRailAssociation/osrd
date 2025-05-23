/* eslint-disable no-nested-ternary */
import { useLayoutEffect, useRef, useState } from 'react';

import cx from 'classnames';
import { isEmpty } from 'lodash';
import { useTranslation } from 'react-i18next';

import { getExceptionType } from 'utils/trainId';

import type { Occurrence } from '../types';

type OccurrenceIndicatorProps = {
  occurrence: Occurrence;
};

const TOOLTIP_BOTTOM_MARGIN = 24;

const OccurrenceIndicator = ({ occurrence }: OccurrenceIndicatorProps) => {
  const { t } = useTranslation('operational-studies', { keyPrefix: 'main.timetable' });
  const exceptionType = getExceptionType(occurrence);
  const dotRef = useRef<HTMLDivElement>(null);
  const changeGroupsRef = useRef<HTMLDivElement>(null);

  const [isHovering, setIsHovering] = useState(false);
  const [position, setPosition] = useState<{
    top?: number;
    left: number;
    bottom?: number;
  } | null>(null);

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

  return (
    <div
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
            <div className="change-groups">
              {occurrence.exceptionChangeGroups &&
                Object.keys(occurrence.exceptionChangeGroups).map((changeGroup, i) => (
                  <span key={i} className="change-group">
                    {changeGroup !== 'category'
                      ? t(`occurrenceChangeGroup.${changeGroup}`)
                      : t(
                          `rollingStock.categoriesOptions.${occurrence.exceptionChangeGroups?.rolling_stock_category?.value}`,
                          { ns: 'translation', keyPrefix: '' }
                        )}
                  </span>
                ))}
            </div>
          </div>
        </div>
      )}
      <span
        className={cx('icon', {
          exception: !isEmpty(occurrence.exceptionChangeGroups),
          disabled: occurrence.disabled,
        })}
      />
    </div>
  );
};

export default OccurrenceIndicator;
