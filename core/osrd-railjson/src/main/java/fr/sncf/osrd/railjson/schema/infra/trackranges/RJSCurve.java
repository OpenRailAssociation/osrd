package fr.sncf.osrd.railjson.schema.infra.trackranges;

import java.util.Objects;

public class RJSCurve extends RJSRange {

    // Radius (m).
    public double radius;

    public RJSCurve(double begin,
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

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof RJSCurve that)) return false;
        if (!super.equals(o)) return false;
        return Objects.equals(radius, that.radius);
    }

    @Override
    public int hashCode() {
        return Objects.hash(super.hashCode(), radius);
    }
}
