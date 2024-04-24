import React from 'react';

import { Eye, EyeClosed } from '@osrd-project/ui-icons';

type EyeToggleProps = {
  checked: boolean;
  onClick: React.FormEventHandler<HTMLDivElement>;
};

function EyeToggle({ checked, onClick }: EyeToggleProps) {
  const eye = checked ? <Eye /> : <EyeClosed />;
  return (
    <div onClick={onClick} role="button" tabIndex={0}>
      {eye}
    </div>
  );
}

export default EyeToggle;
