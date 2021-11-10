package fr.sncf.osrd.railjson.schema.rollingstock;

import com.squareup.moshi.Json;
import com.squareup.moshi.JsonAdapter;
import com.squareup.moshi.Moshi;
import com.squareup.moshi.adapters.PolymorphicJsonAdapterFactory;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.train.RollingStock;
import fr.sncf.osrd.railjson.schema.common.Identified;
import java.util.Map;

public class RJSRollingStock implements Identified {
    public static final JsonAdapter<RJSRollingStock> adapter = new Moshi
            .Builder()
            .add(RJSRollingResistance.adapter)
            .add(RJSMode.adapter)
            .build()
            .adapter(RJSRollingStock.class);

    public static final transient String CURRENT_VERSION = "2.0";

    /** The version of the rolling stock format used */
    public String version = null;

    /** A unique train identifier */
    public String id = null;

    /** A unique identifier, which encodes where this rolling stock data was extracted from */
    public String source = null;

    /** The complete human-readable name */
    @Json(name = "verbose_name")
    public String verboseName = null;

    /** An optional type */
    public String type = null;

    /** An optional sub-type */
    @Json(name = "sub_type")
    public String subType = null;

    /** An optional series name */
    public String series = null;

    /** An optional sub-series name */
    @Json(name = "sub_series")
    public String subSeries = null;

    /** An optional variant name */
    public String variant = null;

    /** The number of rolling stocks assembled together within this unit */
    @Json(name = "units_count")
    public int unitsCount = -1;

    /**
     * <p>Engineers measured a number of effort curves for each rolling stock.
     * These are referenced from effort curve profiles.
     * Effort curves associate a speed to a traction force.
     * https://en.wikipedia.org/wiki/Tractive_force#Tractive_effort_curves</p>
     *
     * <p>The type of this field is somehow misleading, each effort curve is an array
     * of (speed, max_effort) tuples.</p>
     */
    @Json(name = "effort_curves")
    public Map<String, float[][]> effortCurves;

    /**
     * An effort curve profile is a set of rules which associate environmental conditions,
     * such as line voltage or air conditionning settings, to effort curves
     */
    @Json(name = "effort_curve_profiles")
    public Map<String, RJSEffortCurvesProfile[]> effortCurveProfiles;

    /**
     * Each rolling resistance profile is a set of rules which associate environmental conditions,
     * such as the load, to a rolling resistance.
     */
    @Json(name = "rolling_resistance_profiles")
    public Map<String, RJSRollingResistanceProfile[]> rollingResistanceProfiles;

    public RJSLivery[] liveries = null;

    /** the length of the train, in meters.*/
    public double length = Double.NaN;

    /** The max speed of the train, in meters per seconds. */
    @Json(name = "max_speed")
    public double maxSpeed = Double.NaN;

    /**
     * The time the train takes to start up, in seconds.
     * During this time, the train's maximum acceleration is limited.
     */
    @Json(name = "startup_time")
    public double startUpTime = Double.NaN;

    /** The acceleration to apply during the startup state. */
    @Json(name = "startup_acceleration")
    public double startUpAcceleration = Double.NaN;

    /** The maximum acceleration when the train is in its regular operating mode. */
    @Json(name = "comfort_acceleration")
    public double comfortAcceleration = Double.NaN;

    /** The braking deceleration coefficient can be the max or constant (depends on gammaType field). */
    public double gamma = Double.NaN;

    /** The naive braking deceleration coefficient for timetabling. */
    @Json(name = "gamma_type")
    public RollingStock.GammaType gammaType = null;

    /**
     * Inertia coefficient.
     * The mass alone isn't sufficient to compute accelerations, as the wheels and internals
     * also need force to get spinning. This coefficient can be used to account for the difference.
     * It's without unit: effective mass = mass * inertia coefficient
     */
    @Json(name = "inertia_coefficient")
    public double inertiaCoefficient = Double.NaN;

    @Json(name = "power_class")
    public int powerClass = -1;

    /** The list of equipments (protection systems, signaling equipment) the train is able to deal with */
    public RJSTrainFeature[] features = new RJSTrainFeature[0];

    /** The load profiles of the train */
    public RJSTrainMass[] masses = null;

    /** Each train has a number of operation modes (electric, diesel, battery), which come with their own properties */
    public RJSMode[] modes = null;

    // region ROLLING_RESISTANCE

    public static final class RJSRollingResistanceProfile {
        @Json(name = "resistance")
        public RJSRollingResistance resistance;
        @SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
        public RJSRollingResistanceProfileCondition condition;

        public RJSRollingResistanceProfile(
                RJSRollingResistance resistance,
                RJSRollingResistanceProfileCondition condition
        ) {
            this.resistance = resistance;
            this.condition = condition;
        }
    }

    public static final class RJSRollingResistanceProfileCondition {
        @SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
        @Json(name = "load_state")
        public RJSLoadState loadState;

        public RJSRollingResistanceProfileCondition(RJSLoadState loadState) {
            this.loadState = loadState;
        }
    }

    // endregion

    // region EFFORT_CURVES

    public static final class RJSEffortCurvesProfileCondition {
        @SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
        @Json(name = "climate_control")
        public RJSClimateControl climateControl;
        @SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
        public double voltage = Double.NaN;
        @SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
        @Json(name = "catenary_type")
        public String catenaryType;

        /** Creates a condition which filters when a given effort curve should apply */
        public RJSEffortCurvesProfileCondition(RJSClimateControl climateControl, double voltage, String catenaryType) {
            this.climateControl = climateControl;
            this.voltage = voltage;
            this.catenaryType = catenaryType;
        }
    }

    public static final class RJSEffortCurvesProfile {
        @Json(name = "effort_curve")
        public String effortCurve;

        @SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
        public RJSEffortCurvesProfileCondition condition;

        public RJSEffortCurvesProfile(String effortCurves, RJSEffortCurvesProfileCondition condition) {
            this.effortCurve = effortCurves;
            this.condition = condition;
        }
    }

    // endregion

    // region MASSES

    public static final class RJSTrainMass {
        public double mass;
        @Json(name = "load_state")
        public RJSLoadState loadState;

        public RJSTrainMass(double mass, RJSLoadState loadState) {
            this.mass = mass;
            this.loadState = loadState;
        }
    }

    // endregion

    // region MODES

    public static class RJSMode {
        public static final PolymorphicJsonAdapterFactory<RJSMode> adapter = (
                PolymorphicJsonAdapterFactory.of(RJSMode.class, "type")
                        .withSubtype(RJSElectricMode.class, "electric")
                        .withSubtype(RJSDieselMode.class, "diesel")
                        .withSubtype(RJSDieselMode.class, "battery")
        );

        @Json(name = "rolling_resistance_profile")
        public String rollingResistanceProfile = null;

        @Json(name = "effort_curve_profile")
        public String effortCurveProfile = null;
    }

    public static final class RJSDieselMode extends RJSMode {
    }

    public static final class RJSElectricMode extends RJSMode {
        public double voltage = Double.NaN;
        public double frequency = Double.NaN;
    }

    // endregion

    // region LIVERIES

    public static final class RJSLivery {
        @SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
        public String id = null;

        @SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
        public String name = null;

        @SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
        public String[] components = null;
    }

    // endregion

    @Override
    public String getID() {
        return id;
    }
}
