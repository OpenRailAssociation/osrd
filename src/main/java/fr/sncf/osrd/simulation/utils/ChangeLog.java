package fr.sncf.osrd.simulation.utils;

/**
 * A read-only collection of Changes.
 * This corresponds to an event store (an Event Sourcing concept).
 * The renaming is due to Event Sourcing's "Event" renaming to "Change" to avoid confusion with DES events.
 */
public abstract class ChangeLog implements Iterable<Change> {
    /**
     * This method is called from the constructor of all Change instances.
     * It is meant to enable tracking the status of all changes.
     * @param change the just created, not yet initialized change
     */
    public abstract void changeCreationCallback(Change change);

    /**
     * Called when a change is applied, and thus needs to be logged.
     * @param change the just applied change.
     */
    public abstract void changePublishedCallback(Change change);

    /**
     * Returns the number of changes in the changelog
     * @return the size of the changelog (the number of changes)
     */
    public abstract int size();

    /**
     * Returns an iterable over all created changes
     * @return the iterable, or null
     */
    public abstract Iterable<Change> getCreatedChanges();
}
