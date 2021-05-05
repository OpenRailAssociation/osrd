package fr.sncf.osrd.railjson.schema.infra.trackobjects;

import com.squareup.moshi.Json;
import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.railjson.schema.common.Identified;
import fr.sncf.osrd.railjson.schema.infra.railscript.RJSRSExpr;
import fr.sncf.osrd.utils.graph.ApplicableDirection;

public class RJSSignal extends RJSTrackObject implements Identified {
    public String id;

    /** The track direction for which the signal applies */
    @Json(name = "applicable_direction")
    public ApplicableDirection applicableDirection;

    /** The distance at which the signal becomes visible */
    @Json(name = "sight_distance")
    public double sightDistance;

    /** The behavior of the signal */
    public RJSRSExpr expr;

    /** Instantiate RJSSignal */
    public RJSSignal(
            String id,
            ApplicableDirection applicableDirection,
            double position,
            double sightDistance,
            RJSRSExpr expr
    ) throws InvalidInfraException {
        super(position);
        this.id = id;
        this.sightDistance = sightDistance;
        this.expr = expr;
        this.applicableDirection = applicableDirection;
        if (applicableDirection == ApplicableDirection.BOTH)
            throw new InvalidInfraException(String.format("Signal '%s' can't apply for both directions", id));
    }

    @Override
    public ApplicableDirection getApplicableDirection() {
        return applicableDirection;
    }

    @Override
    public String getID() {
        return id;
    }
}
