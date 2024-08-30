import React, { type ReactNode, useEffect, useState } from 'react';

type ForceRemountProps = { fingerprint: string; renderChildren: () => ReactNode };

const ForceRemount = ({ fingerprint, renderChildren }: ForceRemountProps) => {
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
