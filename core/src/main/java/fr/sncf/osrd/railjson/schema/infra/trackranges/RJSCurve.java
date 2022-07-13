package fr.sncf.osrd.railjson.schema.infra.trackranges;

public class RJSCurve extends RJSBiDirectionalTrackRange {

    // Radius (m).
    public double radius;

    RJSCurve(double begin,
            double end,
            double radius
    ) {
        super(begin, end);
        this.radius = radius;
    }

    /** Forces the start position to be lower than the end position. */
    public void simplify() {
        if (this.begin > this.end) {
            var tmp = this.begin;
            this.begin = this.end;
            this.end = tmp;
            this.radius *= -1.;
        }
    }
}
