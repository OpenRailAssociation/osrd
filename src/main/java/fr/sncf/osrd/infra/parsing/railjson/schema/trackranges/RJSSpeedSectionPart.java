package fr.sncf.osrd.infra.parsing.railjson.schema.trackranges;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.parsing.railjson.schema.ID;
import fr.sncf.osrd.infra.parsing.railjson.schema.Navigability;
import fr.sncf.osrd.infra.parsing.railjson.schema.RJSSpeedSection;

@SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
public class RJSSpeedSectionPart extends DirectionalRJSTrackRange {
    public final ID<RJSSpeedSection> ref;

    RJSSpeedSectionPart(ID<RJSSpeedSection> ref, Navigability navigability, double start, double end) {
        super(navigability, start, end);
        this.ref = ref;
    }
}
