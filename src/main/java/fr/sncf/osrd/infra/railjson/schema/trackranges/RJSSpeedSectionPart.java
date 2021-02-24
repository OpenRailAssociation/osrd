package fr.sncf.osrd.infra.railjson.schema.trackranges;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.utils.graph.ApplicableDirections;
import fr.sncf.osrd.infra.railjson.schema.ID;
import fr.sncf.osrd.infra.railjson.schema.RJSSpeedSection;

@SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
public class RJSSpeedSectionPart extends DirectionalRJSTrackRange {
    public final ID<RJSSpeedSection> ref;

    public RJSSpeedSectionPart(
            ID<RJSSpeedSection> ref,
            ApplicableDirections applicableDirections,
            double begin,
            double end
    ) {
        super(applicableDirections, begin, end);
        this.ref = ref;
    }
}
