package fr.sncf.osrd.infra.railjson.schema.trackobjects;

import com.squareup.moshi.Json;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.railjson.schema.ID;
import fr.sncf.osrd.infra.railjson.schema.Identified;
import fr.sncf.osrd.infra.railjson.schema.signaling.RJSSignalExpr;
import fr.sncf.osrd.infra.railjson.schema.signaling.RJSSignalFunction;
import fr.sncf.osrd.utils.graph.ApplicableDirections;
import fr.sncf.osrd.infra.railjson.schema.signaling.RJSSignalObservable;

import java.util.Map;

@SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
public class RJSSignal extends RJSTrackObject implements Identified {
    public final String id;

    /** The track direction for which the signal applies */
    public final ApplicableDirections navigability;

    /** The behavior of the signal */
    public final RJSSignalExpr expr;

    RJSSignal(
            String id,
            ApplicableDirections navigability,
            double position,
            RJSSignalExpr expr
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
