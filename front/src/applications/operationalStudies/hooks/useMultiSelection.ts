import { useCallback, useState } from 'react';

const useMultiSelection = <T extends { id: number }>(
  deleteItemCallback: (itemId: number) => void
) => {
  const [selectedItemIds, setSelectedItemIds] = useState<number[]>([]);
  const [items, setItems] = useState<T[]>([]);
  const deleteItems = useCallback(() => {
    selectedItemIds.forEach((id) => deleteItemCallback(id));
    setItems((prevItems) => prevItems.filter((item) => !selectedItemIds.includes(item.id)));
    setSelectedItemIds([]);
  }, [selectedItemIds, deleteItemCallback]);

  const toggleSelection = useCallback((id: number) => {
    setSelectedItemIds((prevSelectedItemIds) =>
      prevSelectedItemIds.includes(id)
        ? prevSelectedItemIds.filter((selectedItemId) => selectedItemId !== id)
        : prevSelectedItemIds.concat([id])
    );
  }, []);
  return { selectedItemIds, setSelectedItemIds, items, setItems, toggleSelection, deleteItems };
};

export default useMultiSelection;
