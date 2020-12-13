package fr.sncf.osrd.simulation.core;


public class SimulationError extends Exception {
    private static final long serialVersionUID = -7577756566664988508L;

    public SimulationError(String message) {
        super(message);
    }

    public SimulationError(String message, Throwable err) {
        super(message, err);
    }
}
