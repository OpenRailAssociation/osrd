package fr.sncf.osrd.railjson.schema.rollingstock;

import com.squareup.moshi.Json;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import java.util.List;
import java.util.Map;

public class RJSEffortCurves {

    public Map<String, RJSModeEffortCurve> modes = null;

    @Json(name = "default_mode")
    public String defaultMode = null;

    @SuppressFBWarnings("UWF_NULL_FIELD")
    public static final class RJSEffortCurve {
        public double[] speeds = null;

        @Json(name = "max_efforts")
        public double[] maxEfforts = null;
    }

    public static final class RJSModeEffortCurve {
        public List<RJSConditionalEffortCurve> curves;

        @Json(name = "default_curve")
        public RJSEffortCurve defaultCurve = null;

        @Json(name = "is_electric")
        public boolean isElectric;
    }

    public static final class RJSConditionalEffortCurve {
        public RJSEffortCurveConditions cond = null;
        public RJSEffortCurve curve = null;
    }

    public static final class RJSEffortCurveConditions {
        public Comfort comfort = null;

        @Json(name = "electrical_profile_level")
        public String electricalProfileLevel = null;

        @Json(name = "power_restriction_code")
        public String powerRestrictionCode = null;
    }
}
