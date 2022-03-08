package fr.sncf.osrd.new_infra.api.detection;

public interface Route {
    enum State {
        FREE,
        OCCUPIED,
        CONFLICT,
        RESERVED
    }
    State getState();
}
