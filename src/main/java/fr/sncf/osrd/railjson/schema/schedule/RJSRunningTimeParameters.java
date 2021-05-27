package fr.sncf.osrd.railjson.schema.schedule;

import com.squareup.moshi.Json;
import com.squareup.moshi.adapters.PolymorphicJsonAdapterFactory;

public abstract class RJSRunningTimeParameters {
    public static final PolymorphicJsonAdapterFactory<RJSRunningTimeParameters> adapter = (
            PolymorphicJsonAdapterFactory.of(RJSRunningTimeParameters.class, "type")
                    .withSubtype(RJSRunningTimeParameters.Eco.class, "eco")
                    .withSubtype(RJSRunningTimeParameters.Typical.class, "typical")
    );

    public static final class Eco extends RJSRunningTimeParameters {

    }

    public static final class Typical extends RJSRunningTimeParameters {
        @Json(name = "margin_type")
        public String marginType;

        @Json(name = "margin_value")
        public double marginValue;
    }

}
