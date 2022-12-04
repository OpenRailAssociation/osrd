import React, { useState } from 'react';
import GraouImportConfig from 'applications/graou/views/GraouImportConfig';
import GraouTrainsList from 'applications/graou/views/GraouTrainsList';

export default function GraouImport() {
  const [config, setConfig] = useState();

  return (
    <main className="osrd-config-mastcontainer mastcontainer graou-import">
      <div className="p-3">
        <GraouImportConfig setConfig={setConfig} />
        <GraouTrainsList config={config} />
      </div>
    </main>
  );
}
