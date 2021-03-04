package fr.sncf.osrd.infra.railjson.schema.trackobjects;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.railjson.schema.Identified;
import fr.sncf.osrd.infra.railjson.schema.railscript.RJSRSExpr;
import fr.sncf.osrd.utils.graph.ApplicableDirections;

@SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
public class RJSSignal extends RJSTrackObject implements Identified {
    public final String id;

    /** The track direction for which the signal applies */
    public final ApplicableDirections navigability;

    /** The behavior of the signal */
    public final RJSRSExpr expr;

    RJSSignal(
            String id,
            ApplicableDirections navigability,
            double position,
            RJSRSExpr expr
    ) {
        super(position);
        this.id = id;
        this.navigability = navigability;
        this.expr = expr;
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
