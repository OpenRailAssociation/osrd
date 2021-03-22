package fr.sncf.osrd.railjson.schema.infra.trackobjects;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.railjson.schema.common.Identified;
import fr.sncf.osrd.railjson.schema.infra.railscript.RJSRSExpr;
import fr.sncf.osrd.utils.graph.ApplicableDirections;

@SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
public class RJSSignal extends RJSTrackObject implements Identified {
    public final String id;

    /** The track direction for which the signal applies */
    public final ApplicableDirections navigability;

    /** The distance at which the signal becomes visible */
    public final double sightDistance;

    /** The behavior of the signal */
    public final RJSRSExpr expr;

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
