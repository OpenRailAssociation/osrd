import React, { useContext } from 'react';

import type { PathWaypoint } from 'common/api/osrdEditoastApi';
import { ModalBodySNCF, ModalHeaderSNCF } from 'common/BootstrapSNCF/ModalSNCF';
import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';

export default function AllowancesModalOP({
  setPosition,
  pathFindingWaypoints,
}: {
  setPosition: (position: number) => void;
  pathFindingWaypoints: PathWaypoint[];
}) {
  const { closeModal } = useContext(ModalContext);
  return (
    <>
      <ModalHeaderSNCF withCloseButton />
      <ModalBodySNCF>
        <div className="allowances-op-list">
          {pathFindingWaypoints.map((waypoint) => (
            <button
              className="row allowances-op"
              type="button"
              onClick={() => {
                setPosition(waypoint.path_offset);
                closeModal();
              }}
              key={waypoint.path_offset}
            >
              <div className="col-6">{waypoint.path_offset}</div>
              <div className="col-6">
                {waypoint.name}&nbsp;
                {waypoint.ch === '00' || !waypoint.ch ? 'BV' : `${waypoint.ch}`}
              </div>
            </button>
          ))}
        </div>
      </ModalBodySNCF>
    </>
  );
}
