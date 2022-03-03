package fr.sncf.osrd.railjson.schema.schedule;

import com.squareup.moshi.Json;
import com.squareup.moshi.adapters.PolymorphicJsonAdapterFactory;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;

public class RJSAllowance {
    public static final PolymorphicJsonAdapterFactory<RJSAllowance> adapter = (
            PolymorphicJsonAdapterFactory.of(RJSAllowance.class, "allowance_type")
                    .withSubtype(Construction.class, "construction")
                    .withSubtype(Mareco.class, "mareco")
    );

    public static final class Construction extends RJSAllowance {
        @Json(name = "begin_position")
        public double beginPosition = Double.NaN;
        @Json(name = "end_position")
        public double endPosition = Double.NaN;
        @Json(name = "capacity_speed_limit")
        public double capacitySpeedLimit = -1;
        public RJSAllowanceValue value = null;
    }

    public static final class Mareco extends RJSAllowance {
        @Json(name = "default_value")
        public RJSAllowanceValue defaultValue = null;

        public RJSRangeAllowance[] ranges = null;

        @Json(name = "capacity_speed_limit")
        public double capacitySpeedLimit = -1;

        public Mareco(RJSAllowanceValue defaultValue) {
            this.defaultValue = defaultValue;
            this.ranges = null;
        }

        public Mareco() {
            this.defaultValue = null;
            this.ranges = null;
        }
    }

    @SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
    public static final class RJSRangeAllowance {
        @Json(name = "begin_position")
        public double beginPosition = Double.NaN;
        @Json(name = "end_position")
        public double endPosition = Double.NaN;
        public RJSAllowanceValue value = null;
    }
}
