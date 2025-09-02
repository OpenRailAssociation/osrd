import { useState } from 'react';

import useScenario from 'applications/operationalStudies/hooks/useScenario';
import { ScenarioContextProvider } from 'applications/operationalStudies/hooks/useScenarioContext';
import useScenarioQueryParams from 'applications/operationalStudies/hooks/useScenarioQueryParams';
import { RollingStockContextProvider } from 'common/RollingStockContext';
import { SubCategoryContextProvider } from 'common/SubCategoryContext';
import useInfraStatus from 'modules/pathfinding/hooks/useInfraStatus';

import ScenarioHeader from './components/ScenarioHeader';
import type { Board } from '../../types';
import ScenarioContent from './components/ScenarioContent';

const Scenario = () => {
  const { scenario } = useScenario();
  const { infra } = useInfraStatus({ infraId: scenario?.infra_id });

  // Initialize and sync the URL and local storage with Redux
  useScenarioQueryParams();

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
    <ScenarioContextProvider infra={infra} scenario={scenario}>
      <ScenarioHeader activeBoards={activeBoards} toggleBoard={toggleBoard} />
      <RollingStockContextProvider>
        <SubCategoryContextProvider>
          <ScenarioContent activeBoards={activeBoards} />
        </SubCategoryContextProvider>
      </RollingStockContextProvider>
    </ScenarioContextProvider>
  );
};

export default Scenario;
