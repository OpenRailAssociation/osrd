import { describe, expect, it, vi, beforeEach } from 'vitest';

import {
  CheckboxState,
  type CheckboxTreeItem,
  type ItemStates,
  type ParentChildrenMap,
  type ChildrenParentMap,
} from '../type';
import {
  traverseTree,
  buildRelationshipMaps,
  updateItemAndDescendantsStates,
  updateAscendantsStates,
  computeInitialItemStates,
  updateItemStates,
  applyStateToItem,
  computeNewItemsTree,
} from '../utils';

describe('utils', () => {
  const buildItemProps = (id: number, checked: boolean, isIndeterminate?: boolean) => ({
    label: id.toString(),
    checked,
    isIndeterminate,
  });
  const item2 = { id: 2, props: buildItemProps(2, false) };
  const item4 = { id: 4, props: buildItemProps(4, true) };
  const item3 = { id: 3, props: buildItemProps(3, true), items: [item4] };
  const item1 = { id: 1, props: buildItemProps(1, false, true), items: [item2, item3] };
  const item5 = { id: 5, props: buildItemProps(5, false) };

  let tree: CheckboxTreeItem[];
  let parentChildrenMap: ParentChildrenMap;
  let childrenParentMap: ChildrenParentMap;

  beforeEach(() => {
    tree = [item1, item5];
    const relationShips = buildRelationshipMaps(tree);
    parentChildrenMap = relationShips.parentChildrenMap;
    childrenParentMap = relationShips.childrenParentMap;
  });

  describe('traverseTree', () => {
    it('visit all the items', () => {
      const visitedItemIds: number[] = [];
      const onVisit = vi.fn((item: CheckboxTreeItem) => visitedItemIds.push(item.id));

      traverseTree(tree, onVisit);

      expect(onVisit).toHaveBeenCalledTimes(5);
      expect(visitedItemIds.every((item) => [1, 2, 3, 4, 5].includes(item))).toBe(true);
    });
  });

  describe('buildRelationshipMaps', () => {
    it('build correctly relationships maps', () => {
      expect(parentChildrenMap).toEqual({
        1: [2, 3],
        3: [4],
      });

      expect(childrenParentMap).toEqual({
        2: 1,
        3: 1,
        4: 3,
      });
    });
  });

  describe('computeInitialItemStates', () => {
    it('compute correctly initial item states', () => {
      const itemStates = computeInitialItemStates(tree);

      expect(itemStates).toEqual({
        1: CheckboxState.INDETERMINATE,
        2: CheckboxState.UNCHECKED,
        3: CheckboxState.CHECKED,
        4: CheckboxState.CHECKED,
        5: CheckboxState.UNCHECKED,
      });
    });
  });

  describe('updateItemAndDescendantsStates', () => {
    it('update the state of the item and its descendants', () => {
      const itemStates: ItemStates = {
        1: CheckboxState.UNCHECKED,
        2: CheckboxState.UNCHECKED,
        3: CheckboxState.UNCHECKED,
        4: CheckboxState.UNCHECKED,
        5: CheckboxState.UNCHECKED,
      };
      updateItemAndDescendantsStates(3, CheckboxState.CHECKED, parentChildrenMap, itemStates);

      expect(itemStates).toEqual({
        1: CheckboxState.UNCHECKED,
        2: CheckboxState.UNCHECKED,
        3: CheckboxState.CHECKED,
        4: CheckboxState.CHECKED,
        5: CheckboxState.UNCHECKED,
      });
    });
  });

  describe('updateAscendantsStates', () => {
    it('update the state of its ascendants', () => {
      const itemStates: ItemStates = {
        1: CheckboxState.UNCHECKED,
        2: CheckboxState.UNCHECKED,
        3: CheckboxState.CHECKED,
        4: CheckboxState.CHECKED,
        5: CheckboxState.UNCHECKED,
      };

      updateAscendantsStates(4, itemStates, { parentChildrenMap, childrenParentMap });

      expect(itemStates).toEqual({
        1: CheckboxState.INDETERMINATE,
        2: CheckboxState.UNCHECKED,
        3: CheckboxState.CHECKED,
        4: CheckboxState.CHECKED,
        5: CheckboxState.UNCHECKED,
      });
    });
  });

  describe('updateItemStates', () => {
    it('update correctly items ascendants and descendants state according to the new state of the clicked item', () => {
      const initialItemStates: ItemStates = {
        1: CheckboxState.UNCHECKED,
        2: CheckboxState.UNCHECKED,
        3: CheckboxState.UNCHECKED,
        4: CheckboxState.UNCHECKED,
        5: CheckboxState.UNCHECKED,
      };
      const newItemStates = updateItemStates(tree, initialItemStates, 3);
      expect(newItemStates).toEqual({
        1: CheckboxState.INDETERMINATE,
        2: CheckboxState.UNCHECKED,
        3: CheckboxState.CHECKED,
        4: CheckboxState.CHECKED,
        5: CheckboxState.UNCHECKED,
      });
    });
  });

  describe('applyStateToItem', () => {
    it('apply correctly item states to tree items', () => {
      const itemStates: ItemStates = {
        1: CheckboxState.INDETERMINATE,
        2: CheckboxState.CHECKED,
        3: CheckboxState.CHECKED,
        4: CheckboxState.CHECKED,
        5: CheckboxState.UNCHECKED,
      };
      const updatedTree = applyStateToItem(tree, itemStates);
      expect(updatedTree).toEqual([
        {
          id: 1,
          props: { label: '1', isIndeterminate: true },
          items: [
            { id: 2, props: { label: '2', checked: true } },
            {
              id: 3,
              props: { label: '3', checked: true },
              items: [{ id: 4, props: { label: '4', checked: true } }],
            },
          ],
        },
        { id: 5, props: { label: '5', checked: false } },
      ]);
    });
  });

  describe('computeNewItemsTree', () => {
    it('correctly updates the item tree after a click', () => {
      const clickedItem = { id: 3, props: { label: '3', checked: true } };
      const newItemsTree = computeNewItemsTree(tree, clickedItem);
      expect(newItemsTree).toEqual([
        {
          id: 1,
          props: { label: '1', checked: false },
          items: [
            { id: 2, props: { label: '2', checked: false } },
            {
              id: 3,
              props: { label: '3', checked: false },
              items: [{ id: 4, props: { label: '4', checked: false } }],
            },
          ],
        },
        { id: 5, props: { label: '5', checked: false } },
      ]);
    });
  });
});
