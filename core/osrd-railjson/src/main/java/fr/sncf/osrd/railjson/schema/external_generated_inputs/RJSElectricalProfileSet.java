package fr.sncf.osrd.railjson.schema.external_generated_inputs;

import com.squareup.moshi.Json;
import com.squareup.moshi.JsonAdapter;
import com.squareup.moshi.Moshi;
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSTrackRange;

import java.util.List;

public class RJSElectricalProfileSet {
    public static final JsonAdapter<RJSElectricalProfileSet> adapter =
            new Moshi.Builder().build().adapter(RJSElectricalProfileSet.class);

    public List<RJSElectricalProfile> levels;

    public static class RJSElectricalProfile {
        public String value = null;

        @Json(name = "power_class")
        public String powerClass = null;

        @Json(name = "track_ranges")
        public List<RJSTrackRange> trackRanges;

        public RJSElectricalProfile(String value, String powerClass, List<RJSTrackRange> trackRanges) {
            this.value = value;
            this.powerClass = powerClass;
            this.trackRanges = trackRanges;
        }
    }

    public RJSElectricalProfileSet(List<RJSElectricalProfile> levels) {
        this.levels = levels;
    }
}
