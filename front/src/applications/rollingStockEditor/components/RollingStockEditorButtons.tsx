import React from 'react';
import { BiDuplicate, BiTrash } from 'react-icons/bi';
import { FaPencilAlt } from 'react-icons/fa';

type RollingStockEditorButtonsProps = {
  setIsEditing: (isEditing: boolean) => void;
  isRollingStockLocked: boolean;
  isCondensed: boolean;
};

function RollingStockEditorButtons({
  setIsEditing,
  isRollingStockLocked,
  isCondensed,
}: RollingStockEditorButtonsProps) {
  return (
    <div
      className={`rollingstock-editor-buttons ${
        isCondensed ? 'condensed flex-column align-items-center rounded-right' : ''
      } d-flex p-1`}
    >
      <button
        type="button"
        className="btn btn-primary px-1 py-0"
        tabIndex={0}
        disabled={isRollingStockLocked}
        onClick={() => setIsEditing(true)}
      >
        <FaPencilAlt />
      </button>
      <button type="button" className="btn btn-primary px-1 py-0" tabIndex={0}>
        <BiDuplicate />
      </button>
      <button
        type="button"
        className="btn btn-primary px-1 py-0"
        tabIndex={0}
        disabled={isRollingStockLocked}
      >
        <BiTrash />
      </button>
    </div>
  );
}

export default RollingStockEditorButtons;
