package fr.sncf.osrd.railjson.schema.schedule;

import com.squareup.moshi.Json;
import com.squareup.moshi.adapters.PolymorphicJsonAdapterFactory;

public class RJSAllowance {
    public static final PolymorphicJsonAdapterFactory<RJSAllowance> adapter = (
            PolymorphicJsonAdapterFactory.of(RJSAllowance.class, "allowance_type")
                    .withSubtype(EngineeringAllowance.class, "engineering")
                    .withSubtype(StandardAllowance.class, "standard")
    );

    public RJSAllowanceDistribution distribution;
    @Json(name = "capacity_speed_limit")
    public double capacitySpeedLimit = -1;

    /** An allowance which represents portions of the path where the train has to slow down in order to avoid conflicts.
     * Several can be applied by TrainSchedule, and they can overlap other allowances. */
    public static final class EngineeringAllowance extends RJSAllowance {
        @Json(name = "begin_position")
        public double beginPosition = Double.NaN;
        @Json(name = "end_position")
        public double endPosition = Double.NaN;

        public RJSAllowanceValue value;

        /** Default constructor */
        public EngineeringAllowance() {}

        /** Constructor */
        public EngineeringAllowance(
                RJSAllowanceDistribution distribution,
                double begin,
                double end,
                RJSAllowanceValue value,
                double capacitySpeedLimit
        ) {
            this.distribution = distribution;
            this.beginPosition = begin;
            this.endPosition = end;
            this.value = value;
            this.capacitySpeedLimit = capacitySpeedLimit;
        }
    }

    /** An allowance which will affect the whole path.
     * It represents the additional time given to a train to fulfill its schedule.
     * Only one can be applied by TrainSchedule.
     */
    public static final class StandardAllowance extends RJSAllowance {
        @Json(name = "default_value")
        public RJSAllowanceValue defaultValue;

        /**  A list of ranges where different values are applied. Ranges cannot overlap. */
        public RJSAllowanceRange[] ranges;

        /** Constructor with default value only */
        public StandardAllowance(RJSAllowanceDistribution distribution, RJSAllowanceValue defaultValue) {
            this.distribution = distribution;
            this.defaultValue = defaultValue;
            this.ranges = null;
        }

        /** Constructor with default value and ranges */
        public StandardAllowance(RJSAllowanceDistribution distribution,
                                 RJSAllowanceValue defaultValue, RJSAllowanceRange[] ranges) {
            this.distribution = distribution;
            this.defaultValue = defaultValue;
            this.ranges = ranges;
        }
    }
}
