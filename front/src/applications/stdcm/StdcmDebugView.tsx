import { useState } from 'react';

import { useNavigate, useSearchParams } from 'react-router-dom';

import DebugSpaceTimeChart from 'applications/stdcm/components/DebugView/DebugSpaceTimeChart';
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

  const inputForm = (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (inputId.trim()) navigate(`/stdcm/debug?traceId=${encodeURIComponent(inputId.trim())}`);
      }}
    >
      <input
        id="trace-id-input"
        value={inputId}
        onChange={(e) => setInputId(e.target.value)}
        placeholder="Enter trace ID"
      />
      <button type="submit">Open</button>
    </form>
  );

  if (!traceId) {
    return <div>{inputForm}</div>;
  }

  let result;
  if (isLoading) {
    result = <div>Loading...</div>;
  } else if (error) {
    result = <div>Error: {JSON.stringify(error)}</div>;
  } else if (!simulationData) {
    result = <div>No simulation data available</div>;
  } else {
    result = <DebugSpaceTimeChart simulationData={simulationData} />;
  }
  return (
    <div>
      {inputForm}
      {result}
    </div>
  );
};

export default StdcmDebugView;
