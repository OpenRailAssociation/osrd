package fr.sncf.osrd.simulation.changelog;

import fr.sncf.osrd.simulation.Change;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Iterator;

public final class ArrayChangeLog extends ChangeConsumer implements ChangeLog {
    /** The list of all changes that occurred so far in the simulation. */
    public final ArrayList<Change> publishedChanges = new ArrayList<>();

    @Override
    public void changeCreationCallback(Change change) {
    }

    @Override
    public void changePublishedCallback(Change change) {
        publishedChanges.add(change);
    }

    @Override
    public int size() {
        return publishedChanges.size();
    }

    @Override
    public Iterator<Change> iterator() {
        return publishedChanges.iterator();
    }
}
