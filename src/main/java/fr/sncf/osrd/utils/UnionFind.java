package fr.sncf.osrd.utils;

import java.util.ArrayList;

public class UnionFind {
    private final ArrayList<Integer> parents;

    public UnionFind() {
        this.parents = new ArrayList<>();
    }

    /** Create an union find with nbGroup */
    public UnionFind(int nbGroup) {
        this();
        for (int i = 0; i < nbGroup; i++)
            this.parents.add(-1);
    }

    /**
     * Creates a new group.
     * @return the group identifier
     */
    public int newGroup() {
        var groupId = parents.size();
        parents.add(-1);
        return groupId;
    }

    /**
     * Finds the root for some group.
     * @param group the group to find the root of
     * @return the group's root
     */
    public int findRoot(int group) {
        while (parents.get(group) != -1)
            group = parents.get(group);
        return group;
    }

    /**
     * Merge two groups
     * @param groupA first group to merge
     * @param groupB second group to merge
     */
    public void union(int groupA, int groupB) {
        groupA = findRoot(groupA);
        groupB = findRoot(groupB);
        if (groupA == groupB)
            return;

        if (groupA < groupB)
            parents.set(groupB, groupA);
        else
            parents.set(groupA, groupB);
    }

    private ArrayList<Integer> resolve() {
        var res = new ArrayList<Integer>();
        // resolve the chain of merged components
        for (int i = 0; i < parents.size(); i++)
            res.add(findRoot(i));
        return res;
    }

    /**
     * Gets a mapping from group ID from a compact root ID sequence
     * @param groupMap the result container.
     * @return the number of root groups
     */
    public int minimize(ArrayList<Integer> groupMap) {
        var minComponents = new ArrayList<Integer>();
        var resolvedComponents = resolve();
        int numberOfComponents = 0;
        // assign unique identifier to root components
        for (int i = 0; i < resolvedComponents.size(); i++) {
            // if the component is a root, assign a number
            if (resolvedComponents.get(i) == i) {
                minComponents.add(numberOfComponents);
                numberOfComponents++;
            } else {
                minComponents.add(-1);
            }
        }

        groupMap.clear();
        // create the new minimal array from previously gathered metadata
        for (int i = 0; i < resolvedComponents.size(); i++) {
            var rootIndex = resolvedComponents.get(i);
            groupMap.add(minComponents.get(rootIndex));
        }
        return numberOfComponents;
    }
}