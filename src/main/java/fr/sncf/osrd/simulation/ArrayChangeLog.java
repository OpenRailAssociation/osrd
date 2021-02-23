package fr.sncf.osrd.simulation;

import java.util.ArrayList;
import java.util.Iterator;

public final class ArrayChangeLog extends ChangeLog {
    /** The list of all changes that were created so far in the simulation. */
    public final ArrayList<Change> createdChanges = new ArrayList<>();

    /** The list of all changes that occured so far in the simulation. */
    public final ArrayList<Change> publishedChanges = new ArrayList<>();

    @Override
    public void changeCreationCallback(Change change) {
        createdChanges.add(change);
    }

    @Override
    public void changePublishedCallback(Change change) {
        publishedChanges.add(change);
    }

    public int size() {
        return publishedChanges.size();
    }

    @Override
    public Iterator<Change> iterator() {
        return publishedChanges.iterator();
    }

    @Override
    public Iterable<Change> getCreatedChanges() {
        return createdChanges;
    }
}
