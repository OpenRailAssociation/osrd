package fr.sncf.osrd.interactive.action_point_adapters;

import fr.sncf.osrd.infra.signaling.Signal;

public final class SerializedSignal extends SerializedActionPoint {
    public SerializedSignal(Signal signal) {
        super(signal.id);
    }
}
