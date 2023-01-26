package fr.sncf.osrd.railjson.schema;

import com.squareup.moshi.Json;
import com.squareup.moshi.JsonAdapter;
import com.squareup.moshi.Moshi;
import com.squareup.moshi.Types;
import java.lang.reflect.Type;
import java.util.List;
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSTrackRange;

public class RJSElectricalProfile {
    static Type listOfThis = Types.newParameterizedType(List.class, RJSElectricalProfile.class);
    public static final JsonAdapter<List<RJSElectricalProfile>> listAdapter =
            new Moshi.Builder().build().adapter(listOfThis);

    public String value = null;

    @Json(name = "power_class")
    public String powerClass = null;

    @Json(name = "track_ranges")
    public List<RJSTrackRange> trackRanges;
}
