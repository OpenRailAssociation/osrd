package fr.sncf.osrd.railjson.schema.infra.trackranges;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.utils.graph.ApplicableDirection;


@SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
public class RJSCatenarySection extends DirectionalRJSTrackRange {
    public double voltage;

    public RJSCatenarySection(
            ApplicableDirection applicableDirection,
            double begin,
            double end,
            double voltage
    ) {
        super(applicableDirection, begin, end);
        this.voltage = voltage;
    }
}
