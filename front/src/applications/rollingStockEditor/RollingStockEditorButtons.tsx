import React from 'react';
import PropTypes from 'prop-types';
import { BiDuplicate, BiTrash } from 'react-icons/bi';
import { FaPencilAlt } from 'react-icons/fa';

function RollingStockEditorButtons(props: {
  setIsEditing: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const { setIsEditing } = props;
  return (
    <div
      className="d-flex flex-column justify-content-between rounded-left p-3"
      style={{ height: '120px', backgroundColor: '#303383', color: '#fffffff2' }}
    >
      <FaPencilAlt onClick={() => setIsEditing(true)} />
      <BiDuplicate />
      <BiTrash />
    </div>
  );
}

RollingStockEditorButtons.propTypes = {
  setIsEditing: PropTypes.func.isRequired,
};

export default RollingStockEditorButtons;
