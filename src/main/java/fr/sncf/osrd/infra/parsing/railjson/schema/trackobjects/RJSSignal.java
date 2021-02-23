package fr.sncf.osrd.infra.parsing.railjson.schema.trackobjects;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.graph.ApplicableDirections;
import fr.sncf.osrd.infra.parsing.railjson.schema.ID;
import fr.sncf.osrd.infra.parsing.railjson.schema.signaling.RJSSignalTemplate;
import fr.sncf.osrd.infra.parsing.railjson.schema.signaling.RJSSignalObservable;

import java.util.Map;

@SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
public class RJSSignal extends RJSTrackObject {
    /** The track direction for which the signal applies */
    public final ApplicableDirections navigability;

    /** Assigns a value to all the variables of the template */
    public final Map<String, ID<RJSSignalObservable>> parameters;

    /** The behavior rules template */
    public final ID<RJSSignalTemplate> template;

    RJSSignal(
            ApplicableDirections navigability,
            double position,
            Map<String, ID<RJSSignalObservable>> parameters,
            ID<RJSSignalTemplate> template
    ) {
        super(position);
        this.navigability = navigability;
        this.parameters = parameters;
        this.template = template;
    }

    @Override
    public ApplicableDirections getNavigability() {
        return navigability;
    }
}
