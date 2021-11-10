package fr.sncf.osrd.railjson.schema.infra.trackranges;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.railjson.schema.common.ID;
import fr.sncf.osrd.railjson.schema.infra.RJSSpeedSection;
import fr.sncf.osrd.utils.graph.ApplicableDirection;

@SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
public class RJSSpeedSectionPart extends DirectionalRJSTrackRange {
    public ID<RJSSpeedSection> ref;

    public RJSSpeedSectionPart(
            ID<RJSSpeedSection> ref,
            ApplicableDirection applicableDirection,
            double begin,
            double end
    ) {
        super(applicableDirection, begin, end);
        this.ref = ref;
    }
}
