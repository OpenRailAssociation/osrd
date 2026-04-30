import { useState } from 'react';

import { Button, Input } from '@osrd-project/ui-core';
import { Search } from '@osrd-project/ui-icons';
import { useNavigate, useSearchParams } from 'react-router-dom';

import DebugFailureMap from 'applications/stdcm/components/DebugView/DebugFailureMap';
import DebugSpaceTimeChart from 'applications/stdcm/components/DebugView/DebugSpaceTimeChart';
import DebugSpeedDistanceDiagram from 'applications/stdcm/components/DebugView/DebugSpeedDistanceDiagram';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';

const StdcmDebugView = () => {
  const [searchParams] = useSearchParams();
  const traceId = searchParams.get('traceId');
  const navigate = useNavigate();
  const [inputId, setInputId] = useState('');

  const { data, isLoading, error } = osrdEditoastApi.endpoints.getStdcmDebugDataByTraceId.useQuery(
    { traceId: traceId ?? '' },
    { skip: !traceId }
  );
  const simulationData = data?.simulation_data;
  const failureData = data?.failure;

  const handleSubmit = () => {
    if (inputId.trim()) {
      navigate(`/stdcm/debug?traceId=${encodeURIComponent(inputId.trim())}`);
    }
  };

  const form = (
    <form
      className="stdcm-debug-view__form"
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit();
      }}
    >
      <Input
        id="trace-id-input"
        type="text"
        value={inputId}
        onChange={(e) => setInputId(e.target.value)}
        placeholder="Enter trace ID"
        narrow
      />
      <Button label="Open" onClick={handleSubmit} />
    </form>
  );

  if (!traceId) {
    return (
      <div className="stdcm-debug-view">
        <div className="stdcm-debug-view__empty">
          <span className="stdcm-debug-view__empty-icon">
            <Search size="lg" />
          </span>
          <h2>Debug view</h2>
          <p>Enter a trace ID to view debug data for a simulation.</p>
          {form}
        </div>
      </div>
    );
  }

  let result;
  if (isLoading) {
    result = <div className="stdcm-debug-view__status">Loading...</div>;
  } else if (error) {
    result = <div className="stdcm-debug-view__status">Failed to load debug data.</div>;
  } else if (!simulationData && !failureData) {
    result = <div className="stdcm-debug-view__status">No data available for this trace.</div>;
  } else {
    result = (
      <>
        {simulationData && <DebugSpaceTimeChart simulationData={simulationData} />}
        {simulationData && <DebugSpeedDistanceDiagram simulationData={simulationData} />}
        {failureData && <DebugFailureMap failureData={failureData} />}
      </>
    );
  }

  return (
    <div className="stdcm-debug-view">
      <div className="stdcm-debug-view__form-bar">{form}</div>
      {result}
    </div>
  );
};

export default StdcmDebugView;
