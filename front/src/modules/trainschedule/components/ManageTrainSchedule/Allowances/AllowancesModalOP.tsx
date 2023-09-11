import React, { useContext } from 'react';
import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import { PathStep } from 'common/api/osrdEditoastApi';
import { ModalBodySNCF, ModalHeaderSNCF } from 'common/BootstrapSNCF/ModalSNCF';

export default function AllowancesModalOP({
  setPosition,
  pathFindingSteps,
}: {
  setPosition: (position: number) => void;
  pathFindingSteps: PathStep[];
}) {
  const { closeModal } = useContext(ModalContext);
  return (
    <>
      <ModalHeaderSNCF withCloseButton />
      <ModalBodySNCF>
        <div className="allowances-op-list">
          {pathFindingSteps.map((step) => (
            <button
              className="row allowances-op"
              type="button"
              onClick={() => {
                setPosition(step.path_offset);
                closeModal();
              }}
              disabled
            >
              <div className="col-6">{step.path_offset}</div>
              <div className="col-6">{step.name}</div>
            </button>
          ))}
        </div>
      </ModalBodySNCF>
    </>
  );
}
