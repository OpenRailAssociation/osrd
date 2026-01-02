import {
  CheckboxState,
  type CheckboxTreeItem,
  type ChildrenParentMap,
  type ItemStates,
  type ParentChildrenMap,
} from './type';

export const traverseTree = (
  items: CheckboxTreeItem[],
  onVisit: (item: CheckboxTreeItem, parent?: CheckboxTreeItem) => void,
  parent?: CheckboxTreeItem
) => {
  items.forEach((item) => {
    onVisit(item, parent);

    if (item.items && item.items.length > 0) {
      traverseTree(item.items, onVisit, item);
    }
  });
};

export const buildRelationshipMaps = (items: CheckboxTreeItem[]) => {
  const parentChildrenMap: ParentChildrenMap = {};
  const childrenParentMap: ChildrenParentMap = {};

  traverseTree(items, (item, parent) => {
    if (parent?.id !== undefined) {
      if (!parentChildrenMap[parent.id]) {
        parentChildrenMap[parent.id] = [];
      }
      parentChildrenMap[parent.id].push(item.id);
      childrenParentMap[item.id] = parent.id;
    }
  });

  return { parentChildrenMap, childrenParentMap };
};

export const updateItemAndDescendantsStates = (
  itemId: number,
  newItemStates: CheckboxState,
  parentChildrenMap: ParentChildrenMap,
  itemStates: ItemStates
) => {
  itemStates[itemId] = newItemStates;
  parentChildrenMap[itemId]?.forEach((child) =>
    updateItemAndDescendantsStates(child, newItemStates, parentChildrenMap, itemStates)
  );
};

export const updateAscendantsStates = (
  childId: number,
  itemStates: ItemStates,
  relastionShipMap: {
    parentChildrenMap: ParentChildrenMap;
    childrenParentMap: ChildrenParentMap;
  }
) => {
  const { parentChildrenMap, childrenParentMap } = relastionShipMap;
  const parentId = childrenParentMap[childId];
  if (parentId === undefined) return;

  const siblings = parentChildrenMap[parentId];

  const siblingStates = siblings.map((siblingId) => itemStates[siblingId]);

  let parentState: CheckboxState;
  if (siblingStates.every((state) => state === CheckboxState.CHECKED)) {
    parentState = CheckboxState.CHECKED;
  } else if (siblingStates.every((state) => state === CheckboxState.UNCHECKED)) {
    parentState = CheckboxState.UNCHECKED;
  } else {
    parentState = CheckboxState.INDETERMINATE;
  }
  itemStates[parentId] = parentState;
  updateAscendantsStates(parentId, itemStates, { parentChildrenMap, childrenParentMap });
};

export const updateItemStates = (
  itemsTree: CheckboxTreeItem[],
  initialItemStates: ItemStates,
  clickedItemId: number
): ItemStates => {
  const newItemStates = { ...initialItemStates };
  const newClickedItemState =
    newItemStates[clickedItemId] === CheckboxState.CHECKED
      ? CheckboxState.UNCHECKED
      : CheckboxState.CHECKED;
  const { parentChildrenMap, childrenParentMap } = buildRelationshipMaps(itemsTree);
  updateItemAndDescendantsStates(
    clickedItemId,
    newClickedItemState,
    parentChildrenMap,
    newItemStates
  );
  updateAscendantsStates(clickedItemId, newItemStates, { parentChildrenMap, childrenParentMap });

  return newItemStates;
};

export const computeInitialItemStates = (items: CheckboxTreeItem[]): ItemStates => {
  const itemStates: ItemStates = {};
  traverseTree(items, (item) => {
    if (item.props.isIndeterminate) itemStates[item.id] = CheckboxState.INDETERMINATE;
    else itemStates[item.id] = item.props.checked ? CheckboxState.CHECKED : CheckboxState.UNCHECKED;
  });
  return itemStates;
};

export const applyStateToItem = (itemsTree: CheckboxTreeItem[], itemStates: ItemStates) => {
  const clonedItemsTree = JSON.parse(JSON.stringify(itemsTree));
  traverseTree(clonedItemsTree, (item) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { checked, isIndeterminate, ...otherProps } = item.props;
    item.props = otherProps;
    if (itemStates[item.id] === CheckboxState.INDETERMINATE) item.props.isIndeterminate = true;
    else if (itemStates[item.id] === CheckboxState.CHECKED) item.props.checked = true;
    else item.props.checked = false;
  });

  return clonedItemsTree;
};

export const computeNewItemsTree = (
  itemsTree: CheckboxTreeItem[],
  clickedItem: CheckboxTreeItem
): CheckboxTreeItem[] => {
  const initialItemStates = computeInitialItemStates(itemsTree);
  const updatedItemStates = updateItemStates(itemsTree, initialItemStates, clickedItem.id);
  return applyStateToItem(itemsTree, updatedItemStates);
};
