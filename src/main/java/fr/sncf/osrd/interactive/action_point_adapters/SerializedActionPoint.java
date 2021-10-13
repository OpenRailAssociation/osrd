package fr.sncf.osrd.interactive.action_point_adapters;

import com.squareup.moshi.adapters.PolymorphicJsonAdapterFactory;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.OperationalPoint;
import fr.sncf.osrd.infra.StopActionPoint;
import fr.sncf.osrd.infra.signaling.ActionPoint;
import fr.sncf.osrd.infra.signaling.Signal;
import fr.sncf.osrd.infra.trackgraph.Waypoint;
import fr.sncf.osrd.train.phases.NavigatePhase;

public abstract class SerializedActionPoint {
    public final String id;

    protected SerializedActionPoint(String id) {
        this.id = id;
    }

    public static final PolymorphicJsonAdapterFactory<SerializedActionPoint> adapter = (
            PolymorphicJsonAdapterFactory.of(SerializedActionPoint.class, "type")
                    .withSubtype(SerializedWaypoint.class, "WAYPOINT")
                    .withSubtype(SerializedSignal.class, "SIGNAL")
                    .withSubtype(SerializedStop.class, "STOP")
                    .withSubtype(SerializedSwitch.class, "SWITCH")
                    .withSubtype(SerializedOperationalPoint.class, "OPERATIONAL_POINT"));

    /** Serialize action point */
    @SuppressFBWarnings({"BC_UNCONFIRMED_CAST"})
    public static SerializedActionPoint from(ActionPoint actionPoint) {
        if (actionPoint instanceof Waypoint)
            return new SerializedWaypoint((Waypoint) actionPoint);
        if (actionPoint.getClass() == Signal.class)
            return new SerializedSignal((Signal) actionPoint);
        if (actionPoint.getClass() == OperationalPoint.class)
            return new SerializedOperationalPoint((OperationalPoint) actionPoint);
        if (actionPoint.getClass() == NavigatePhase.SwitchActionPoint.class)
            return new SerializedSwitch((NavigatePhase.SwitchActionPoint) actionPoint);
        if (actionPoint.getClass() == StopActionPoint.class)
            return new SerializedStop((StopActionPoint) actionPoint);
        throw new RuntimeException("Action point couldn't be serialized");
    }
}
