package fr.sncf.osrd.railjson.schema.infra.trackranges;

import java.util.Objects;

public class RJSSlope extends RJSRange {
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

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof RJSSlope that)) return false;
        if (!super.equals(o)) return false;
        return Objects.equals(gradient, that.gradient);
    }

    @Override
    public int hashCode() {
        return Objects.hash(super.hashCode(), gradient);
    }
}
