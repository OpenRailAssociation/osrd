import { useMemo, useState, useEffect } from 'react';

import type { Board } from '../types';

export function usePersistScenarioHeader(scenarioId: number | undefined, defaultBoards: Board[]) {
  const storageKey = useMemo<string | undefined>(
    () => (scenarioId === undefined ? undefined : `scenario:${scenarioId}:boards`),
    [scenarioId]
  );

  const [activeBoards, setActiveBoards] = useState<Set<Board>>(() => new Set(defaultBoards));

  useEffect(() => {
    if (!storageKey) setActiveBoards(new Set(defaultBoards));
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey) return;
    const saved = localStorage.getItem(storageKey);
    if (!saved) return;

    setActiveBoards(new Set(JSON.parse(saved) as Board[]));
  }, [storageKey]);

  const toggleBoard = (board: Board) => {
    setActiveBoards((prev) => {
      const newActiveBoards = new Set([...prev]);
      if (newActiveBoards.has(board)) newActiveBoards.delete(board);
      else newActiveBoards.add(board);
      if (storageKey) {
        localStorage.setItem(storageKey, JSON.stringify([...newActiveBoards]));
      }
      return newActiveBoards;
    });
  };

  return { activeBoards, toggleBoard };
}
