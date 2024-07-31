import { useCallback, useState } from 'react';

const useMultiSelection = <T extends { id: number }>(
  deleteItemCallback: (itemId: number) => void
) => {
  const [selectedItemIds, setSelectedItemIds] = useState<number[]>([]);
  const [items, setItems] = useState<T[]>([]);

  const deleteItems = useCallback(() => {
    selectedItemIds.forEach((id) => deleteItemCallback(id));
    setItems(items.filter((item) => !selectedItemIds.includes(item.id)));
    setSelectedItemIds([]);
  }, [selectedItemIds, deleteItemCallback]);

  const toggleSelection = useCallback(
    (id: number) => {
      setSelectedItemIds(
        selectedItemIds.indexOf(id) !== -1
          ? selectedItemIds.filter((selectedItemId) => selectedItemId !== id)
          : selectedItemIds.concat([id])
      );
    },
    [selectedItemIds]
  );
  return { selectedItemIds, setSelectedItemIds, items, setItems, toggleSelection, deleteItems };
};

export default useMultiSelection;
