package fr.sncf.osrd.interactive.action_point_adapters;

import fr.sncf.osrd.infra.OperationalPoint;

public final class SerializedOperationalPoint extends SerializedActionPoint {
    public SerializedOperationalPoint(OperationalPoint op) {
        super(op.id);
    }
}
