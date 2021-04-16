package fr.sncf.osrd.railjson.schema.infra.trackobjects;

import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.railjson.schema.common.Identified;
import fr.sncf.osrd.railjson.schema.infra.railscript.RJSRSExpr;
import fr.sncf.osrd.utils.graph.ApplicableDirections;

public class RJSSignal extends RJSTrackObject implements Identified {
    public String id;

    /** The track direction for which the signal applies */
    public ApplicableDirections navigability;

    /** The distance at which the signal becomes visible */
    public double sightDistance;

    /** The behavior of the signal */
    public RJSRSExpr expr;

    /** Instantiate RJSSignal */
    public RJSSignal(
            String id,
            ApplicableDirections navigability,
            double position,
            double sightDistance,
            RJSRSExpr expr
    ) throws InvalidInfraException {
        super(position);
        this.id = id;
        this.sightDistance = sightDistance;
        this.expr = expr;
        this.navigability = navigability;
        if (navigability == ApplicableDirections.BOTH)
            throw new InvalidInfraException(String.format("Signal '%s' can't apply for both directions", id));
    }

    @Override
    public ApplicableDirections getNavigability() {
        return navigability;
    }

    @Override
    public String getID() {
        return id;
    }
}
