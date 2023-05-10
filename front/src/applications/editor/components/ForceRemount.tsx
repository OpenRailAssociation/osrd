import React, { FC, ReactNode, useEffect, useState } from 'react';

const ForceRemount: FC<{ fingerprint: string; renderChildren: () => ReactNode }> = ({
  fingerprint,
  renderChildren,
}) => {
  const [renderState, setRenderState] = useState<
    { skipRender: true } | { skipRender: false; renderChildren: () => ReactNode }
  >({ skipRender: true });
  useEffect(() => {
    setRenderState({ skipRender: true });
    const timeout = setTimeout(() => setRenderState({ skipRender: false, renderChildren }), 0);
    return () => {
      clearTimeout(timeout);
    };
  }, [fingerprint]);

  if (renderState.skipRender) {
    return null;
  }

  return <>{renderState.renderChildren()}</>;
};

export default ForceRemount;
