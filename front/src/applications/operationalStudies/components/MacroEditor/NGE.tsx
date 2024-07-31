import React, { useEffect, useRef, useState } from 'react';

/* eslint-disable import/extensions, import/no-unresolved */
import ngeMain from '@osrd-project/netzgrafik-frontend/dist/netzgrafik-frontend/en/main.js?url';
import ngePolyfills from '@osrd-project/netzgrafik-frontend/dist/netzgrafik-frontend/en/polyfills.js?url';
import ngeRuntime from '@osrd-project/netzgrafik-frontend/dist/netzgrafik-frontend/en/runtime.js?url';
import ngeStyles from '@osrd-project/netzgrafik-frontend/dist/netzgrafik-frontend/en/styles.css?url';
import ngeVendor from '@osrd-project/netzgrafik-frontend/dist/netzgrafik-frontend/en/vendor.js?url';
/* eslint-enable import/extensions, import/no-unresolved */

import type { NetzgrafikDto } from './types';

interface NGEElement extends HTMLElement {
  netzgrafikDto: NetzgrafikDto;
}

const frameSrc = `
<!DOCTYPE html>
<html class="sbb-lean sbb-light">
  <head>
    <link rel="stylesheet" href="${ngeStyles}"></link>
    <script type="module" src="${ngeRuntime}"></script>
    <script type="module" src="${ngePolyfills}"></script>
    <script type="module" src="${ngeVendor}"></script>
    <script type="module" src="${ngeMain}"></script>
  </head>
  <body></body>
</html>
`;

const NGE = ({ dto }: { dto?: NetzgrafikDto }) => {
  const frameRef = useRef<HTMLIFrameElement>(null);

  const [ngeRootElement, setNgeRootElement] = useState<NGEElement | null>(null);
  useEffect(() => {
    const frame = frameRef.current!;

    const handleFrameLoad = () => {
      frame.removeEventListener('load', handleFrameLoad);

      const ngeRoot = frame.contentDocument!.createElement('sbb-root') as NGEElement;
      frame.contentDocument!.body.appendChild(ngeRoot);
      setNgeRootElement(ngeRoot);

      // listens to create, update and delete operations
      // ngeRoot.addEventListener('operation', (event: Event) => {
      //   console.log('Operation received', (event as CustomEvent).detail);
      // });
    };

    frame.addEventListener('load', handleFrameLoad);

    return () => {
      frame.removeEventListener('load', handleFrameLoad);
    };
  }, []);

  useEffect(() => {
    if (ngeRootElement && dto) {
      ngeRootElement.netzgrafikDto = dto;
    }
  }, [dto, ngeRootElement]);

  return <iframe ref={frameRef} srcDoc={frameSrc} title="NGE" className="nge-iframe-container" />;
};

export default NGE;
