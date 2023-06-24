import React, { useContext } from 'react';
import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import { PathStep } from 'common/api/osrdEditoastApi';
import { ModalBodySNCF } from 'common/BootstrapSNCF/ModalSNCF';

export default function AllowancesModalOP({
  setPosition,
  pathFindingSteps,
}: {
  setPosition: (position: number) => void;
  pathFindingSteps: PathStep[];
}) {
  const { closeModal } = useContext(ModalContext);
  return (
    <ModalBodySNCF>
      <div className="allowances-op-list">
        {pathFindingSteps.map((step) => (
          <div
            className="row allowances-op"
            role="button"
            tabIndex={0}
            onClick={() => {
              setPosition(step.position);
              closeModal();
            }}
          >
            <div className="col-6">{step.position}</div>
            <div className="col-6">{step.name}</div>
          </div>
        ))}
      </div>
    </ModalBodySNCF>
  );
}
