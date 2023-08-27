import { isNull } from 'lodash';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { MdArrowRight } from 'react-icons/md';
import { getTranslationKey } from 'utils/strings';
import cx from 'classnames';
import { FaTrash } from 'react-icons/fa';

const DEFAULT_SELECTORS_CLASSNAME = 'selector-SNCF';

export default function SelectorSNCF<T extends string | null, K extends string>(props: {
  mainClass?: string;
  borderClass: string;
  title: K;
  itemsList: T[];
  selectedItem?: T;
  hoveredItem?: string | null;
  onItemSelected?: (value: T) => void;
  onItemHovered?: (value: string | null) => void;
  onItemRemoved?: (value: T, key: K) => void;
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
    onItemRemoved,
    translationFile,
    translationList = '',
  } = props;
  const { t } = useTranslation(translationFile);

  return (
    <div className={`${mainClass}`}>
      <div className={`${mainClass}-title ${borderClass} pl-1 pb-1`}>
        <h2 className="mb-0 text-blue">{t(title)}</h2>
      </div>
      <div className="d-flex align-items-center position-relative">
        <div className={cx(`${mainClass}-itemslist`, borderClass, 'overflow-auto', 'p-2')}>
          {useMemo(
            () =>
              itemsList.map((item, index: number) => (
                <div
                  className={cx(`${mainClass}-item`, 'd-flex', 'mb-1', borderClass, {
                    selected: item === selectedItem,
                    hovered: item === hoveredItem && item !== null,
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
                  <div className={`${mainClass}-item-name pt-1 pl-3`}>
                    {!isNull(item)
                      ? t(getTranslationKey(translationList, String(item)))
                      : t('unspecified')}
                  </div>
                  {onItemRemoved && (
                    <div className={`${mainClass}-trash-icon`}>
                      <FaTrash onClick={() => onItemRemoved(item, title)} />
                    </div>
                  )}
                </div>
              )),
            [itemsList, selectedItem, hoveredItem]
          )}
        </div>
        <div className={`${mainClass}-arrow`}>
          <MdArrowRight />
        </div>
      </div>
    </div>
  );
}
