import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { get } from 'axios';
import GraouImportConfig from 'applications/graou/views/GraouImportConfig';

export default function GraouImport() {
  const { t } = useTranslation(['graou']);
  const [config, setConfig] = useState();
  const [trainsList, setTrainList] = useState();

  async function getTrains() {
    try {
      console.log(config);
    } catch (error) {
      console.log(error);
    }
  }

  useEffect(() => {
    if (config) {
      getTrains();
    } else {
      setTrainList(undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  return (
    <main className="osrd-config-mastcontainer mastcontainer graou-import">
      <div className="p-3">
        <GraouImportConfig setConfig={setConfig} />
      </div>
    </main>
  );
}
