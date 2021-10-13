package fr.sncf.osrd.interactive;

public enum SessionState {
    /** No infrastructure is loaded */
    UNINITIALIZED,
    /** An infrastructure is loaded, but the user has not provided a simulation task */
    WAITING_FOR_SIMULATION,
    /** The simulation is ready to go */
    PAUSED,
    /** The simulation is currently running */
    RUNNING,
}
