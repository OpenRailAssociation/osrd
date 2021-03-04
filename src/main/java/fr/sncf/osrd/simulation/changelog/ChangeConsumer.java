package fr.sncf.osrd.simulation.changelog;

import fr.sncf.osrd.simulation.Change;

public abstract class ChangeConsumer {
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
}
