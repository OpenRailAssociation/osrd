package fr.sncf.osrd.railjson.schema.infra.trackranges;

import fr.sncf.osrd.utils.graph.ApplicableDirection;

public class RJSSlope extends RJSTrackRange {
    // Gradient (m)
    public double gradient;

    public RJSSlope(
            double begin,
            double end,
            double gradient
    ) {
        super(begin, end);
        this.gradient = gradient;
    }

    @Override
    public ApplicableDirection getNavigability() {
        return ApplicableDirection.BOTH;
    }
}
