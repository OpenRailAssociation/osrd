package fr.sncf.osrd.infra.state;

public abstract class StatefulInfraObject<T> {
    /**
     * Creates a new state for this object.
     * @return
     */
    abstract T newState();

    /**
     * Gets the state of the object in the global hashmap.
     * This operation isn't type safe, and probably will never be.
     * @param state the state of the infrastructure
     * @return the state of this object
     */
    @SuppressWarnings("unchecked")
    public T getState(InfraState state) {
        return (T) state.stateMap.get(this);
    }
}
