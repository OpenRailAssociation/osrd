import { useRef } from 'react';

import { Button, Input } from '@osrd-project/ui-core';
import { Search } from '@osrd-project/ui-icons';
import { skipToken } from '@reduxjs/toolkit/query';
import { useNavigate, useSearchParams } from 'react-router-dom';

import DebugFailureMap from 'applications/stdcm/components/DebugView/DebugFailureMap';
import DebugSpaceTimeChart from 'applications/stdcm/components/DebugView/DebugSpaceTimeChart';
import DebugSpeedDistanceDiagram from 'applications/stdcm/components/DebugView/DebugSpeedDistanceDiagram';
import { osrdEditoastApi } from 'common/api/osrdEditoastApi';

const StdcmDebugView = () => {
  const [searchParams] = useSearchParams();
  const traceId = searchParams.get('traceId');
  const navigate = useNavigate();
  const formRef = useRef<HTMLFormElement | null>(null);

  const {
    data: { simulation_data, failure } = {},
    isLoading,
    error,
  } = osrdEditoastApi.endpoints.getStdcmDebugDataByTraceId.useQuery(
    traceId ? { traceId } : skipToken
  );

  const handleSubmit = () => {
    if (formRef.current) {
      const id = (new FormData(formRef.current).get('traceId') as string).trim();
      if (id) navigate(`/stdcm/debug?traceId=${encodeURIComponent(id)}`);
    }
  };

  const form = (
    <form
      ref={formRef}
      className="stdcm-debug-view__form"
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit();
      }}
    >
      <Input id="trace-id-input" name="traceId" type="text" placeholder="Enter trace ID" narrow />
      <Button label="Open" onClick={() => {}} />
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
  let viewStatus = null;
  if (isLoading) viewStatus = 'Loading...';
  else if (error) viewStatus = 'Failed to load debug data.';
  else if (!simulation_data && !failure) viewStatus = 'No data available for this trace.';

  return (
    <div className="stdcm-debug-view">
      <div className="stdcm-debug-view__form-bar">{form}</div>
      {simulation_data && (
        <>
          <DebugSpaceTimeChart simData={simulation_data} />
          <DebugSpeedDistanceDiagram simData={simulation_data} />
        </>
      )}
      {failure && <DebugFailureMap failureData={failure} />}
      {!simulation_data && !failure && <div className="stdcm-debug-view__status">{viewStatus}</div>}
    </div>
  );
};

export default StdcmDebugView;
