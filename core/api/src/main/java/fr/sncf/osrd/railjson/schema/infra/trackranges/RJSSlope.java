package fr.sncf.osrd.railjson.schema.infra.trackranges;

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
