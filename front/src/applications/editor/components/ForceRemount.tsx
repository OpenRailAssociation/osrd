import React, { FC, ReactNode, useEffect, useState } from 'react';

const ForceRemount: FC<{ fingerprint: string; renderChildren: () => ReactNode }> = ({
  fingerprint,
  renderChildren,
}) => {
  const [skipRender, setSkipRender] = useState(false);

  useEffect(() => {
    setSkipRender(true);
    const timeout = setTimeout(() => setSkipRender(true), 0);
    return () => {
      clearTimeout(timeout);
    };
  }, [fingerprint]);

  if (skipRender) {
    return null;
  }
  return <>{renderChildren()}</>;
};

export default ForceRemount;
