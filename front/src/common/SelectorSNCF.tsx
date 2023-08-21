import { isNull } from 'lodash';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { MdArrowRight } from 'react-icons/md';

export default function SelectorSNCF(props: {
  mainClass?: string;
  borderClass: string;
  title: string;
  itemsList: string[];
  selectedItem?: string | null;
  setSelectedItem?: (arg: string) => void;
  updateItemInStore?: (value: string) => void;
  translationFile: string;
  translationList?: string;
}) {
  const {
    mainClass,
    borderClass,
    title,
    itemsList,
    selectedItem,
    setSelectedItem,
    updateItemInStore,
    translationFile,
    translationList,
  } = props;
  const { t } = useTranslation(translationFile);
  return (
    <div className={`${mainClass || 'selector-SNCF'}`}>
      <div className={`${mainClass || 'selector-SNCF'}-title ${borderClass}`}>
        <h2 className="mb-0 text-blue">{t(title)}</h2>
      </div>
      <div className="d-flex align-items-center position-relative">
        <div
          className={`${mainClass || 'selector-SNCF'}-itemslist overflow-auto ${borderClass} p-2`}
        >
          {useMemo(
            () =>
              itemsList.map((item: string, index: number) => (
                <div
                  className={`${mainClass || 'selector-SNCF'}-item ${
                    item === selectedItem ? 'selected' : ''
                  } ${borderClass} mb-1`}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    if (setSelectedItem) setSelectedItem(item);
                    if (updateItemInStore) updateItemInStore(item);
                  }}
                  key={`selector-${title}-${index}`}
                >
                  <div>
                    {!isNull(item)
                      ? t(`${translationList !== undefined ? `${translationList}.` : ''}${item}`)
                      : t('unspecified')}
                  </div>
                </div>
              )),
            [itemsList, selectedItem]
          )}
        </div>
        <div className={`${mainClass || 'selector-SNCF'}-arrow`}>
          <MdArrowRight />
        </div>
      </div>
    </div>
  );
}
