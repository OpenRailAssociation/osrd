package fr.sncf.osrd.infra.parsing.railjson.schema.signaling;

import com.squareup.moshi.Json;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.parsing.railjson.schema.ID;

@SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
public abstract class RJSSignalRule {
    /** If this condition is true, the rule applies */
    public final RJSSignalCondition when;

    /** The aspect that must be shown if the condition is true */
    @Json(name = "show_aspect")
    public final ID<RJSAspect> showAspect;

    RJSSignalRule(
            RJSSignalCondition when, ID<RJSAspect> showAspect
    ) {
        this.when = when;
        this.showAspect = showAspect;
    }
}
