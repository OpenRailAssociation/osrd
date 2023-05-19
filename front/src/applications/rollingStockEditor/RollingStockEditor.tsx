import React, { useRef, useState } from 'react';
import PropTypes from 'prop-types';

import { LightRollingStock } from 'common/api/osrdEditoastApi';
import RollingStockCard from 'common/RollingStockSelector/RollingStockCard';
import { useSelector } from 'react-redux';
import { getRollingStockID } from 'reducers/osrdconf/selectors';
import RollingStockEditorButtons from './RollingStockEditorButtons';
import RollingStockEditorForm from './RollingStockEditorForm';

export default function RollingStockEditor(props: {
  data: LightRollingStock;
  setOpenedRollingStockCardId: React.Dispatch<React.SetStateAction<number | undefined>>;
  openedRollingStockCardId: number | undefined;
}) {
  const ref2scroll: React.RefObject<HTMLInputElement> = useRef<HTMLInputElement>(null);
  const rollingStockID = useSelector(getRollingStockID);
  const [isEditing, setIsEditing] = useState(false);
  const { data, openedRollingStockCardId, setOpenedRollingStockCardId } = props;

  return (
    <div className="d-flex align-self-center w-75" style={{ maxWidth: '700px' }}>
      {data.id === openedRollingStockCardId && !isEditing ? (
        <RollingStockEditorButtons setIsEditing={setIsEditing} />
      ) : null}
      {isEditing && data.id === openedRollingStockCardId ? (
        <RollingStockEditorForm setIsEditing={setIsEditing} data={data} />
      ) : (
        <RollingStockCard
          displayEditorButtons
          data={data}
          key={data.id}
          noCardSelected={openedRollingStockCardId === undefined}
          isOpen={data.id === openedRollingStockCardId}
          setOpenedRollingStockCardId={setOpenedRollingStockCardId}
          ref2scroll={rollingStockID === data.id ? ref2scroll : undefined}
        />
      )}
    </div>
  );
}

RollingStockEditor.propTypes = {
  data: PropTypes.object.isRequired,
  setOpenedRollingStockCardId: PropTypes.func.isRequired,
  openedRollingStockCardId: PropTypes.number,
};
