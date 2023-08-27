import { isNull } from 'lodash';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { MdArrowRight } from 'react-icons/md';
import { getTranslationKey } from 'utils/strings';
import cx from 'classnames';

const DEFAULT_SELECTORS_CLASSNAME = 'selector-SNCF';

export default function SelectorSNCF<T>(props: {
  mainClass?: string;
  borderClass: string;
  title: string;
  itemsList: T[];
  selectedItem?: T;
  hoveredItem?: T;
  onItemSelected?: (value: T) => void;
  onItemHovered?: (value: T) => void;
  translationFile: string;
  translationList?: string;
}) {
  const {
    mainClass = DEFAULT_SELECTORS_CLASSNAME,
    borderClass,
    title,
    itemsList,
    selectedItem,
    hoveredItem,
    onItemSelected,
    onItemHovered,
    translationFile,
    translationList = '',
  } = props;
  const { t } = useTranslation(translationFile);

  return (
    <div className={`${mainClass} mb-2`}>
      <div className={`${mainClass}-title ${borderClass} ml-2 mb-1`}>
        <h2 className="mb-0 text-blue">{t(title)}</h2>
      </div>
      <div className="d-flex align-items-center position-relative">
        <div className={cx(`${mainClass}-itemslist`, borderClass, 'overflow-auto', 'p-2')}>
          {useMemo(
            () =>
              itemsList.map((item, index: number) => (
                <div
                  className={cx(`${mainClass}-item`, 'mb-1', borderClass, {
                    selected: item === selectedItem,
                    hovered: item === hoveredItem,
                  })}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    if (onItemSelected) onItemSelected(item);
                  }}
                  onMouseOver={() => {
                    if (onItemHovered) onItemHovered(item);
                  }}
                  onFocus={() => {
                    if (onItemHovered) onItemHovered(item);
                  }}
                  key={`selector-${title}-${index}`}
                >
                  <div>
                    {!isNull(item)
                      ? t(getTranslationKey(translationList, String(item)))
                      : t('unspecified')}
                  </div>
                </div>
              )),
            [itemsList, selectedItem]
          )}
        </div>
        <div className={`${mainClass}-arrow`}>
          <MdArrowRight />
        </div>
      </div>
    </div>
  );
}
