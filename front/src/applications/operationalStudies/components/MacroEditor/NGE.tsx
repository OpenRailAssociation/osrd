import React, { useEffect, useRef } from 'react';

import ngeMain from '@osrd-project/netzgrafik-frontend/dist/netzgrafik-frontend/en/main.js?url';
import ngePolyfills from '@osrd-project/netzgrafik-frontend/dist/netzgrafik-frontend/en/polyfills.js?url';
import ngeRuntime from '@osrd-project/netzgrafik-frontend/dist/netzgrafik-frontend/en/runtime.js?url';
import ngeStyles from '@osrd-project/netzgrafik-frontend/dist/netzgrafik-frontend/en/styles.css?url';
import ngeVendor from '@osrd-project/netzgrafik-frontend/dist/netzgrafik-frontend/en/vendor.js?url';

import 'styles/scss/applications/operationalStudies/_nge.scss';

const frameSrc = `
<!DOCTYPE html>
<html class="sbb-lean">
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

function NGE() {
  const frameRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const frame = frameRef.current!;

    function handleFrameLoad() {
      frame.removeEventListener('load', handleFrameLoad);

      const ngeRoot = frame.contentDocument!.createElement('sbb-root') as HTMLElement;
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
    }

    frame.addEventListener('load', handleFrameLoad);

    return () => {
      frame.removeEventListener('load', handleFrameLoad);
    };
  }, []);

  return <iframe ref={frameRef} srcDoc={frameSrc} title="nge-iframe" />;
}

export default NGE;
