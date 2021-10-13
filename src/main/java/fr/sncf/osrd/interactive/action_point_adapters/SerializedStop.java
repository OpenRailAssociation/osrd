package fr.sncf.osrd.interactive.action_point_adapters;

import fr.sncf.osrd.infra.StopActionPoint;

public class SerializedStop extends SerializedActionPoint {
    public SerializedStop(StopActionPoint stop) {
        super(String.format("stop.%d", stop.stopIndex));
    }
}
