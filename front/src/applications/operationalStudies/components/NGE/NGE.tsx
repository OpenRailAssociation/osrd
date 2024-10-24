import { useEffect, useRef, useState } from 'react';

/* eslint-disable import/extensions, import/no-unresolved */
import ngeMain from '@osrd-project/netzgrafik-frontend/dist/netzgrafik-frontend/main.js?url';
import ngePolyfills from '@osrd-project/netzgrafik-frontend/dist/netzgrafik-frontend/polyfills.js?url';
import ngeRuntime from '@osrd-project/netzgrafik-frontend/dist/netzgrafik-frontend/runtime.js?url';
import ngeStyles from '@osrd-project/netzgrafik-frontend/dist/netzgrafik-frontend/styles.css?url';
import ngeVendor from '@osrd-project/netzgrafik-frontend/dist/netzgrafik-frontend/vendor.js?url';
/* eslint-enable import/extensions, import/no-unresolved */

import type { NetzgrafikDto, NGEEvent } from './types';

interface NGEElement extends HTMLElement {
  netzgrafikDto: NetzgrafikDto;
}

type NGEProps = {
  dto?: NetzgrafikDto;
  onOperation?: (op: NGEEvent, netzgrafikDto: NetzgrafikDto) => void;
};

const frameSrc = `
<!DOCTYPE html>
<html class="sbb-lean sbb-light">
  <head>
    <base href="/netzgrafik-frontend/">
    <link rel="stylesheet" href="${ngeStyles}"></link>
    <script type="module" src="${ngeRuntime}"></script>
    <script type="module" src="${ngePolyfills}"></script>
    <script type="module" src="${ngeVendor}"></script>
    <script type="module" src="${ngeMain}"></script>
  </head>
  <body></body>
</html>
`;

/**
 * Standalone NetzGraphik Editor component.
 *
 * Abstracts away low-level NGE details. Doesn't contain any OSRD-specific
 * logic.
 */
const NGE = ({ dto, onOperation }: NGEProps) => {
  const frameRef = useRef<HTMLIFrameElement>(null);

  const [ngeRootElement, setNgeRootElement] = useState<NGEElement | null>(null);

  useEffect(() => {
    const frame = frameRef.current!;

    const handleFrameLoad = () => {
      const ngeRoot = frame.contentDocument!.createElement('sbb-root') as NGEElement;
      frame.contentDocument!.body.appendChild(ngeRoot);
      setNgeRootElement(ngeRoot);
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

  useEffect(() => {
    if (ngeRootElement && onOperation) {
      const fnOpListener = (event: Event) => {
        const customEvent = event as CustomEvent;
        const op = customEvent.detail as NGEEvent;
        if (onOperation) onOperation(op, ngeRootElement.netzgrafikDto);
      };
      ngeRootElement.addEventListener('operation', fnOpListener);
      return () => {
        ngeRootElement.removeEventListener('operation', fnOpListener);
      };
    }
    return () => {};
  }, [onOperation, ngeRootElement]);

  return <iframe ref={frameRef} srcDoc={frameSrc} title="NGE" className="nge-iframe-container" />;
};

export default NGE;
