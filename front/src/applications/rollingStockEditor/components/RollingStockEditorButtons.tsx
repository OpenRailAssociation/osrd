import React from 'react';
import { BiDuplicate, BiTrash } from 'react-icons/bi';
import { FaPencilAlt } from 'react-icons/fa';

type RollingStockEditorButtonsProps = {
  setIsEditing: (isEditing: boolean) => void;
  isCondensed: boolean;
};

function RollingStockEditorButtons({ setIsEditing, isCondensed }: RollingStockEditorButtonsProps) {
  return (
    <div
      className={`rollingstock-editor-buttons ${
        isCondensed ? 'condensed flex-column align-items-center rounded-right' : ''
      } d-flex p-1`}
    >
      <div
        role="button"
        tabIndex={0}
        className="btn-primary rounded px-2 py-1"
        onClick={() => setIsEditing(true)}
      >
        <FaPencilAlt />
      </div>
      <div role="button" tabIndex={0} className="btn-primary rounded px-2 py-1">
        <BiDuplicate />
      </div>
      <div role="button" tabIndex={0} className="btn-primary rounded px-2 py-1">
        <BiTrash />
      </div>
    </div>
  );
}

export default RollingStockEditorButtons;
