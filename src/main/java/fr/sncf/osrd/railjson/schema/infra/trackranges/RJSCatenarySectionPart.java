package fr.sncf.osrd.railjson.schema.infra.trackranges;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.railjson.schema.common.ID;
import fr.sncf.osrd.railjson.schema.infra.RJSCatenaryType;
import fr.sncf.osrd.utils.graph.ApplicableDirection;


@SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
public class RJSCatenarySectionPart extends DirectionalRJSTrackRange {
    public ID<RJSCatenaryType> ref;

    public RJSCatenarySectionPart(
            ID<RJSCatenaryType> ref,
            ApplicableDirection applicableDirection,
            double begin,
            double end
    ) {
        super(applicableDirection, begin, end);
        this.ref = ref;
    }
}
