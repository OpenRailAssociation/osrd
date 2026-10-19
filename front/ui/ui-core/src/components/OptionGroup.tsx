import React, { useEffect, useRef, type ReactNode, type RefObject } from 'react';

import cx from 'classnames';

import useOutsideClick from '../hooks/useOutsideClick';
import { usePopoverPosition } from '../hooks/usePopoverPosition';

export type OptionGroupItem<T> = {
  value: T;
  label: string;
};

export type OptionGroupSection<T> = {
  title: string;
  items: OptionGroupItem<T>[];
  icon?: ReactNode;
};

export type OptionGroupProps<T> = {
  triggerRef: RefObject<HTMLElement | null>;
  isOpen: boolean;
  onClose: () => void;
  sections: OptionGroupSection<T>[];
  selectedValue?: T;
  onSelect: (value: T) => void;
  getItemKey: (value: T) => string;
};

const OptionGroup = <T,>({
  triggerRef,
  isOpen,
  onClose,
  sections,
  selectedValue,
  onSelect,
  getItemKey,
}: OptionGroupProps<T>) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const { popoverPosition, calculatePosition } = usePopoverPosition(
    triggerRef,
    panelRef,
    0,
    'start',
    'top'
  );

  useEffect(() => {
    if (isOpen && panelRef.current && !panelRef.current.matches(':popover-open')) {
      panelRef.current.showPopover();
      calculatePosition();
    }
  }, [isOpen, calculatePosition]);

  useOutsideClick(isOpen ? panelRef : null, onClose);

  if (!isOpen) return null;

  return (
    <div
      ref={panelRef}
      className="ui-option-group"
      popover="manual"
      style={{ top: popoverPosition.top, left: popoverPosition.left }}
    >
      {sections.map((section) => (
        <div key={section.title} className="option-group-section">
          <div className="option-group-section-title">{section.title}</div>
          {section.items.map((item) => {
            const itemKey = getItemKey(item.value);
            return (
              <button
                key={itemKey}
                type="button"
                className={cx('option-group-item', {
                  selected: selectedValue !== undefined && itemKey === getItemKey(selectedValue),
                })}
                title={item.label}
                onClick={() => {
                  onSelect(item.value);
                  onClose();
                }}
              >
                <span className="option-group-item-label">{item.label}</span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
};

export default OptionGroup;
