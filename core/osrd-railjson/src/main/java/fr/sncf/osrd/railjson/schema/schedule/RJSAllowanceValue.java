package fr.sncf.osrd.railjson.schema.schedule;

import com.squareup.moshi.adapters.PolymorphicJsonAdapterFactory;

public class RJSAllowanceValue {
    public static final PolymorphicJsonAdapterFactory<RJSAllowanceValue> adapter = (
            PolymorphicJsonAdapterFactory.of(RJSAllowanceValue.class, "value_type")
                    .withSubtype(TimePerDistance.class, "time_per_distance")
                    .withSubtype(Time.class, "time")
                    .withSubtype(Percent.class, "percentage")
    );

    public static final class TimePerDistance extends RJSAllowanceValue {
        public double minutes;

        public TimePerDistance() {
            this(Double.NaN);
        }

        public TimePerDistance(double minutes) {
            this.minutes = minutes;
        }
    }

    public static final class Time extends RJSAllowanceValue {
        public double seconds;

        public Time() {
            this(Double.NaN);
        }

        public Time(double seconds) {
            this.seconds = seconds;
        }
    }

    public static final class Percent extends RJSAllowanceValue {
        public double percentage;

        public Percent() {
            this(Double.NaN);
        }

        public Percent(double percentage) {
            this.percentage = percentage;
        }
    }
}
