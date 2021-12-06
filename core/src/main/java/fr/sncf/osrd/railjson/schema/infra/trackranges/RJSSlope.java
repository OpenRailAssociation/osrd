package fr.sncf.osrd.railjson.schema.infra.trackranges;

import fr.sncf.osrd.railjson.schema.common.ObjectRef;
import fr.sncf.osrd.railjson.schema.infra.RJSTrackSection;

public class RJSSlope extends BiDirectionalRJSTrackRange {
    // Gradient (m)
    public double gradient;

    public RJSSlope(double begin,
            double end,
            double gradient
    ) {
        super(begin, end);
        this.gradient = gradient;
    }
}
