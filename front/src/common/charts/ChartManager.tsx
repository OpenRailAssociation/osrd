import React, { useState } from 'react';

export default function ChartManager() {
  const [simulationTime, setSimulationTime] = useState<string | undefined>(undefined);
  const [scheduledTrainSelected, setScheduledTrainSelected] = useState<number | undefined>(
    undefined
  );
  const [horizontalZoom, sethorizontalZoom] = useState<number | undefined>(undefined);

  return null;
}
