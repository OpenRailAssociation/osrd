package fr.sncf.osrd.infra;

import fr.sncf.osrd.simulation.Entity;

public abstract class StatefulInfraObject<T extends Entity> {
    /**
     * Creates a new state for this object.
     * @return a fresh state for this infrastructure object
     */
    public abstract T newState();
}
