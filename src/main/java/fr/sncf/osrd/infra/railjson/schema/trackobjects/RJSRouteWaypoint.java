package fr.sncf.osrd.infra.railjson.schema.trackobjects;

import com.squareup.moshi.adapters.PolymorphicJsonAdapterFactory;
import fr.sncf.osrd.infra.railjson.schema.Identified;
import fr.sncf.osrd.utils.graph.ApplicableDirections;
import fr.sncf.osrd.utils.graph.IPointValue;

public abstract class RJSRouteWaypoint
        extends DirectionalRJSTrackObject
        implements Identified, IPointValue<RJSRouteWaypoint> {
    public final String id;

    public static final PolymorphicJsonAdapterFactory<RJSRouteWaypoint> adapter =
            PolymorphicJsonAdapterFactory.of(RJSRouteWaypoint.class, "type")
                    .withSubtype(RJSTrainDetector.class, "detector")
                    .withSubtype(RJSBufferStop.class, "buffer_stop");

    RJSRouteWaypoint(String id, ApplicableDirections applicableDirections, double position) {
        super(applicableDirections, position);
        this.id = id;
    }

    @Override
    public String getID() {
        return id;
    }

    @Override
    public double getPosition() {
        return position;
    }

    @Override
    public RJSRouteWaypoint getValue() {
        return this;
    }
}