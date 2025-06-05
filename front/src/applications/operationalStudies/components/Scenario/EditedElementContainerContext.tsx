import { createContext, type ReactNode, useState, useMemo } from 'react';

type EditedElementContainerContextType = {
  editedElementContainer: HTMLDivElement | null;
  setEditedElementContainer: (el: HTMLDivElement) => void;
};

export const EditedElementContainerContext = createContext<EditedElementContainerContextType>({
  editedElementContainer: null,
  setEditedElementContainer: () => {},
});

export const EditedElementContainerProvider = ({ children }: { children: ReactNode }) => {
  const [editedElementContainer, setEditedElementContainer] = useState<HTMLDivElement | null>(null);
  const contextValue = useMemo(
    () => ({ editedElementContainer, setEditedElementContainer }),
    [editedElementContainer, setEditedElementContainer]
  );
  return (
    <EditedElementContainerContext.Provider value={contextValue}>
      {children}
    </EditedElementContainerContext.Provider>
  );
};
