package fr.sncf.osrd.railjson.schema.infra.trackranges;

public class RJSSlope extends RJSBiDirectionalTrackRange {
    // Gradient (m)
    public double gradient;

    public RJSSlope(double begin,
            double end,
            double gradient
    ) {
        super(begin, end);
        this.gradient = gradient;
    }

    /** Forces the start position to be lower than the end position. */
    public void simplify() {
        if (this.begin > this.end) {
            var tmp = this.begin;
            this.begin = this.end;
            this.end = tmp;
            this.gradient *= -1.;
        }
    }
}
