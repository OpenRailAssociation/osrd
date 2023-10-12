import { isNull } from 'lodash';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { MdArrowRight } from 'react-icons/md';
import { getTranslationKey } from 'utils/strings';
import cx from 'classnames';
import { FaTrash } from 'react-icons/fa';
import InputSNCF from './BootstrapSNCF/InputSNCF';

const DEFAULT_SELECTORS_CLASSNAME = 'selector-SNCF';

export default function SelectorSNCF<
  T extends string | null,
  K extends string,
  // All of these 3 properties have to be defined for the extra column to work so we pass them in an object
  U extends {
    defaultValue: string;
    data: {
      [key: string]: string;
    };
    updateData: (datas: U['data']) => void;
  }
>(props: {
  mainClass?: string;
  borderClass: string;
  title: K;
  itemsList: T[];
  permanentItems?: T[];
  selectedItem?: T;
  hoveredItem?: string | null;
  onItemSelected?: (value: T) => void;
  onItemHovered?: (value: string | null) => void;
  onItemRemoved?: (value: T, key: K) => void;
  translationFile: string;
  translationList?: string;
  // Define in case we use the selector to display [power restriction code, power class] tupple
  extraColumn?: U;
}) {
  const {
    mainClass = DEFAULT_SELECTORS_CLASSNAME,
    borderClass,
    title,
    itemsList,
    permanentItems,
    selectedItem,
    hoveredItem,
    onItemSelected,
    onItemHovered,
    onItemRemoved,
    translationFile,
    translationList = '',
    extraColumn,
  } = props;
  const { t } = useTranslation(translationFile);

  return (
    <div className={extraColumn ? `${mainClass}-with-extra-column` : `${mainClass}`}>
      <div className={`${mainClass}-title ${borderClass} pl-1 pb-1`}>
        <h2 className="mb-0 text-blue">{t(title)}</h2>
      </div>
      <div className="d-flex align-items-center position-relative">
        <div className={`${mainClass}-itemslist ${borderClass} overflow-auto p-2`}>
          {itemsList.map(
            (item, index: number) => (
              <div
                className={cx({ 'd-flex ml-1': extraColumn })}
                key={`selector-${title}-${index}`}
              >
                <div
                  className={cx(`${mainClass}-item`, 'd-flex', 'mb-1', borderClass, {
                    'with-extra-column': extraColumn,
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
                  onMouseOut={() => {
                    if (onItemHovered) onItemHovered(null);
                  }}
                  onBlur={() => {
                    if (onItemHovered) onItemHovered(null);
                  }}
                  key={`selector-${title}-${index}`}
                >
                  <div
                    className={`${mainClass}-item-name pt-1 pl-3`}
                    title={
                      !isNull(item)
                        ? t(getTranslationKey(translationList, String(item)))
                        : t('unspecified')
                    }
                  >
                    {!isNull(item)
                      ? t(getTranslationKey(translationList, String(item)))
                      : t('unspecified')}
                  </div>
                  {((permanentItems && !permanentItems.includes(item)) || !permanentItems) &&
                    onItemRemoved && (
                      <button
                        type="button"
                        tabIndex={0}
                        onClick={() => onItemRemoved(item, title)}
                        className={`${mainClass}-trash-icon `}
                      >
                        <FaTrash />
                      </button>
                    )}
                </div>
                {extraColumn && (
                  <div
                    className={cx(`extra-column`, 'mb-1', 'ml-3', {
                      disabled: isNull(item),
                    })}
                  >
                    <InputSNCF
                      id={`selector-${title}-${index}`}
                      type="string"
                      whiteBG
                      sm
                      noMargin
                      disabled={isNull(item)}
                      value={
                        isNull(item) ? extraColumn.defaultValue : extraColumn.data[item as string]
                      }
                      onChange={(e) =>
                        extraColumn.updateData({
                          ...extraColumn.data,
                          [item as string]: e.target.value,
                        })
                      }
                    />
                  </div>
                )}
              </div>
            ),
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
