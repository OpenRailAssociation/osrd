import React, { useEffect, useRef } from 'react';

/* eslint-disable import/extensions, import/no-unresolved */
import ngeMain from 'netzgrafik-frontend/dist/netzgrafik-frontend/main.js?url';
import ngePolyfills from 'netzgrafik-frontend/dist/netzgrafik-frontend/polyfills.js?url';
import ngeRuntime from 'netzgrafik-frontend/dist/netzgrafik-frontend/runtime.js?url';
import ngeStyles from 'netzgrafik-frontend/dist/netzgrafik-frontend/styles.css?url';
import ngeVendor from 'netzgrafik-frontend/dist/netzgrafik-frontend/vendor.js?url';
/* eslint-enable import/extensions, import/no-unresolved */

const frameSrc = `
<!DOCTYPE html>
<html class="sbb-lean">
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

const NGE = () => {
  const frameRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const frame = frameRef.current!;

    const handleFrameLoad = () => {
      frame.removeEventListener('load', handleFrameLoad);

      const ngeRoot = frame.contentDocument!.createElement('sbb-root');
      frame.contentDocument!.body.appendChild(ngeRoot);

      // listens to create, update and delete operations
      // ngeRoot.addEventListener('operation', (event: Event) => {
      //   console.log('Operation received', (event as CustomEvent).detail);
      // });

      // get netzgrafik model from NGE
      // let netzgrafikDto = ngeRoot.netzgrafikDto;

      // // set new netzgrafik model with new nodes
      // netzgrafikDto.nodes = testNodesDto;
      // ngeRoot.netzgrafikDto = netzgrafikDto;
    };

    frame.addEventListener('load', handleFrameLoad);

    return () => {
      frame.removeEventListener('load', handleFrameLoad);
    };
  }, []);

  return <iframe ref={frameRef} srcDoc={frameSrc} title="NGE" className="nge-iframe-container" />;
};

export default NGE;
