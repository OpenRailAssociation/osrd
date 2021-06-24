package fr.sncf.osrd.railjson.schema.infra.trackranges;

import fr.sncf.osrd.utils.graph.ApplicableDirection;

public class RJSCurve extends RJSTrackRange {

    public double radius;
    public RJSCurve(
            double begin,
            double end,
            double radius
    ) {
        super(begin, end);
        this.radius = radius;
    }

    @Override
    public ApplicableDirection getNavigability() {
        return ApplicableDirection.BOTH;
    }
}
