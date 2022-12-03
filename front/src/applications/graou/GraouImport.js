import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import StationSelector, { formatStation } from './components/StationSelector';

export default function GraouImport() {
  const { t } = useTranslation(['graou']);
  const [from, setFrom] = useState();
  const [fromSearchString, setFromSearchString] = useState('');
  const [to, setTo] = useState();
  const [toSearchString, setToSearchString] = useState('');

  return (
    <main className="osrd-config-mastcontainer mastcontainer">
      <div className="p-3">
        <div className="row">
          <div className="col-lg-4">
            <div className="osrd-config-item mb-2">
              <div className="osrd-config-item-container">
                <h2>{t('from')}</h2>
                {from ? (
                  <div
                    className="result-station-selected"
                    onClick={() => setFrom(undefined)}
                    role="button"
                    tabIndex={0}
                  >
                    {formatStation(from)}
                  </div>
                ) : (
                  <StationSelector
                    onSelect={setFrom}
                    term={fromSearchString}
                    setTerm={setFromSearchString}
                  />
                )}
              </div>
            </div>
          </div>
          <div className="col-lg-4">
            <div className="osrd-config-item mb-2">
              <div className="osrd-config-item-container">
                <h2>{t('to')}</h2>
                {to ? (
                  <div
                    className="result-station-selected"
                    onClick={() => setTo(undefined)}
                    role="button"
                    tabIndex={0}
                  >
                    {formatStation(to)}
                  </div>
                ) : (
                  <StationSelector
                    onSelect={setTo}
                    term={toSearchString}
                    setTerm={setToSearchString}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
