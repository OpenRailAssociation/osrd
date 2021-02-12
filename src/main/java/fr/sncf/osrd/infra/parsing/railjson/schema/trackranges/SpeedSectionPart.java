package fr.sncf.osrd.infra.parsing.railjson.schema.trackranges;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.parsing.railjson.schema.ID;
import fr.sncf.osrd.infra.parsing.railjson.schema.Navigability;
import fr.sncf.osrd.infra.parsing.railjson.schema.SpeedSection;

@SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
public class SpeedSectionPart extends DirectionalTrackRange {
    public final ID<SpeedSection> ref;

    SpeedSectionPart(ID<SpeedSection> ref, Navigability navigability, double start, double end) {
        super(navigability, start, end);
        this.ref = ref;
    }
}
