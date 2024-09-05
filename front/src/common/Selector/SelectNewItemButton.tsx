import { useState } from 'react';

import cx from 'classnames';
import { RiAddFill } from 'react-icons/ri';

import SelectImprovedSNCF from 'common/BootstrapSNCF/SelectImprovedSNCF';

export default function SelectNewItemButton<
  T extends string,
  O extends
    | T
    | {
        id: T;
        label: string;
      },
>({
  options,
  disabled,
  authorizeNewItem,
  addNewItemButtonText,
  customOnClick,
  selectNewItem,
}: {
  options: O[];
  disabled?: boolean;
  authorizeNewItem?: boolean;
  addNewItemButtonText?: string;
  customOnClick?: () => void;
  selectNewItem: (arg: T) => void;
}) {
  const [isSelectVisible, setIsSelectVisible] = useState(false);

  return (
    <div>
      <button
        type="button"
        className={cx('select-new-item-button', 'mb-2', {
          disabled: disabled || options.length === 0,
        })}
        aria-label="add new item"
        onClick={() => (customOnClick ? customOnClick() : setIsSelectVisible(true))}
      >
        <RiAddFill />
      </button>
      {isSelectVisible && (
        <div className="selector-select">
          <SelectImprovedSNCF
            options={options}
            onChange={(e) => {
              if (e) {
                selectNewItem((typeof e === 'string' ? e : e.id) as T);
                setIsSelectVisible(false);
              }
            }}
            withNewValueInput={authorizeNewItem}
            addButtonTitle={addNewItemButtonText}
            setSelectVisibility={setIsSelectVisible}
            withSearch
            noTogglingHeader
            isOpened
            bgWhite
          />
        </div>
      )}
    </div>
  );
}
