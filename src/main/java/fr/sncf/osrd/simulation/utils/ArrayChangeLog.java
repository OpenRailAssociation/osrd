package fr.sncf.osrd.simulation.utils;

import java.util.ArrayList;
import java.util.Iterator;

public final class ArrayChangeLog extends ChangeLog {
    /** The list of all changes that occured so far in the simulation. */
    public final ArrayList<Change> changes = new ArrayList<>();

    public long publishedChanges = 0;

    @Override
    public void changeCreationCallback(Change change) {
        changes.add(change);
    }

    @Override
    public void changePublishedCallback(Change change) {
        publishedChanges++;
    }

    public int size() {
        return changes.size();
    }

    @Override
    public Iterator<Change> iterator() {
        return changes.iterator();
    }
}
