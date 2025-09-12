import { useState } from 'react';

import useScenario from 'applications/operationalStudies/hooks/useScenario';
import { ScenarioContextProvider } from 'applications/operationalStudies/hooks/useScenarioContext';
import { RollingStockContextProvider } from 'common/RollingStockContext';
import { SubCategoryContextProvider } from 'common/SubCategoryContext';

import ScenarioHeader from './components/ScenarioHeader';
import type { Board } from '../../types';
import ScenarioContent from './components/ScenarioContent';

const Scenario = () => {
  const { scenario } = useScenario();

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

  if (!scenario) return null;

  return (
    <ScenarioContextProvider scenario={scenario}>
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
