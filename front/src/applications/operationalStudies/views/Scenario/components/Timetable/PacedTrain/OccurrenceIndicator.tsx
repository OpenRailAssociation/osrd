import { useRef, useState } from 'react';

import cx from 'classnames';
import { isEmpty } from 'lodash';
import { useTranslation } from 'react-i18next';

import type { SubCategory } from 'common/api/osrdEditoastApi';
import OSRDTooltip from 'common/OSRDTooltip';
import isMainCategory from 'modules/rollingStock/helpers/category';
import type { Occurrence, ExceptionChangeGroups } from 'modules/timetableItem/types';
import { getExceptionType } from 'utils/trainId';

import { getTrainCategoryClassName } from '../utils';

type OccurrenceIndicatorProps = {
  occurrence: Occurrence;
  subCategories?: SubCategory[];
};

/**
 * The bullet that marks each item of the list of occurrences, with its tooltip.
 */
const OccurrenceIndicator = ({ occurrence, subCategories }: OccurrenceIndicatorProps) => {
  const { t } = useTranslation(['operational-studies', 'translation'], {
    keyPrefix: 'main.timetable',
  });
  const dotRef = useRef<HTMLDivElement>(null);

  const [isHovering, setIsHovering] = useState(false);

  const exceptionType = getExceptionType(occurrence);

  const tooltipHeader = () => {
    if (occurrence.disabled) {
      return t('occurrenceType.disabledOccurrence');
    }
    if (exceptionType === 'modified') {
      return t('occurrenceType.editedOccurrence');
    }
    return t('occurrenceType.addedOccurrence');
  };

  const categoryValue = occurrence.category;

  const displayedChangeGroups =
    occurrence.exceptionChangeGroups &&
    Object.entries(occurrence.exceptionChangeGroups)
      .filter(([_, isPresent]) => isPresent !== null)
      .map(([changeGroup]) => changeGroup as keyof ExceptionChangeGroups)
      .map((changeGroup) => {
        let occurrenceCategory;

        if (categoryValue && isMainCategory(categoryValue)) {
          occurrenceCategory = t(`rollingStock.categoriesOptions.${categoryValue.main_category}`, {
            ns: 'translation',
            keyPrefix: '',
          });
        } else if (categoryValue && !isMainCategory(categoryValue)) {
          const matchingSubCategory = subCategories?.find(
            (opt) => opt.code === categoryValue.sub_category_code
          );

          occurrenceCategory =
            matchingSubCategory?.name ||
            t('rollingStock.categoriesOptions.noCategory', {
              ns: 'translation',
              keyPrefix: '',
            });
        } else {
          occurrenceCategory = t('rollingStock.categoriesOptions.noCategory', {
            ns: 'translation',
            keyPrefix: '',
          });
        }

        return changeGroup !== 'rolling_stock_category'
          ? t(`occurrenceChangeGroup.${changeGroup}`)
          : occurrenceCategory;
      });

  const currentSubCategory =
    categoryValue && !isMainCategory(categoryValue)
      ? subCategories?.find((opt) => opt.code === categoryValue.sub_category_code)
      : null;

  return (
    <div
      data-testid="occurrence-indicator"
      className="occurrence-indicator"
      ref={dotRef}
      onMouseEnter={() => {
        setIsHovering(true);
      }}
      onMouseLeave={() => {
        setIsHovering(false);
      }}
    >
      {isHovering && (occurrence.disabled || !isEmpty(occurrence.exceptionChangeGroups)) && (
        <OSRDTooltip
          containerRef={dotRef}
          header={tooltipHeader()}
          items={displayedChangeGroups || []}
          offsetRatio={{ top: 0.5, left: 1 }}
        />
      )}
      <span
        className={cx('icon', getTrainCategoryClassName(occurrence.category, 'bg'), {
          exception: !isEmpty(occurrence.exceptionChangeGroups),
          disabled: occurrence.disabled,
        })}
        style={{
          backgroundColor: currentSubCategory?.color,
        }}
      />
    </div>
  );
};

export default OccurrenceIndicator;
