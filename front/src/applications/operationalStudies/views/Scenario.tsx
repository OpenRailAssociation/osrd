import { useState } from 'react';

import { useSelector } from 'react-redux';

import ScenarioContent from 'applications/operationalStudies/components/Scenario/ScenarioContent';
import useScenario from 'applications/operationalStudies/hooks/useScenario';
import { ScenarioContextProvider } from 'applications/operationalStudies/hooks/useScenarioContext';
import useScenarioQueryParams from 'applications/operationalStudies/hooks/useScenarioQueryParams';
import { RollingStockContextProvider } from 'common/RollingStockContext';
import useInfraStatus from 'modules/pathfinding/hooks/useInfraStatus';
import { getOperationalStudiesInfraID } from 'reducers/osrdconf/operationalStudiesConf/selectors';

import type { Board } from '../types';
import ScenarioHeader from '../v2/components/ScenarioHeader';

const Scenario = () => {
  const { scenario } = useScenario();

  const infraId = useSelector(getOperationalStudiesInfraID);

  // Initialize and sync the URL and local storage with Redux
  useScenarioQueryParams();

  const infraData = useInfraStatus({ infraId });
  const { infra } = infraData;

  const [activeBoards, setActiveBoards] = useState<Set<Board>>(
    new Set<Board>(['trains', 'map', 'std', 'sdd', 'tables'])
  );

  const toggleBoard = (board: Board) => {
    setActiveBoards((prev) => {
      const newActiveBoards = new Set([...prev]);
      if (newActiveBoards.has(board)) newActiveBoards.delete(board);
      else newActiveBoards.add(board);
      return newActiveBoards;
    });
  };

  if (!scenario || !infra) return null;

  return (
    <ScenarioContextProvider infraId={infra.id}>
      <ScenarioHeader
        scenario={scenario}
        infra={infra}
        activeBoards={activeBoards}
        toggleBoard={toggleBoard}
      />
      <RollingStockContextProvider>
        <ScenarioContent
          scenario={scenario}
          infra={infra}
          infraMetadata={infraData}
          activeBoards={activeBoards}
        />
      </RollingStockContextProvider>
    </ScenarioContextProvider>
  );
};

export default Scenario;
