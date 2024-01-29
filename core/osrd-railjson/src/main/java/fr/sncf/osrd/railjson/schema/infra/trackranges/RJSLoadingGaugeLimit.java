package fr.sncf.osrd.railjson.schema.infra.trackranges;

import fr.sncf.osrd.railjson.schema.rollingstock.RJSLoadingGaugeType;
import java.util.Objects;

public class RJSLoadingGaugeLimit extends RJSRange {

    public RJSLoadingGaugeType category;

    public RJSLoadingGaugeLimit(double begin, double end, RJSLoadingGaugeType category) {
        super(begin, end);
        this.category = category;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof RJSLoadingGaugeLimit that)) return false;
        if (!super.equals(o)) return false;
        return Objects.equals(category, that.category);
    }

    @Override
    public int hashCode() {
        return Objects.hash(super.hashCode(), category);
    }
}
