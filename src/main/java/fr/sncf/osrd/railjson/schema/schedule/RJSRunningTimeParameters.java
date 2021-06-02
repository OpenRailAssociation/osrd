package fr.sncf.osrd.railjson.schema.schedule;

import com.squareup.moshi.Json;
import com.squareup.moshi.adapters.PolymorphicJsonAdapterFactory;

/** Describes the parameters for the running time */
public abstract class RJSRunningTimeParameters {
    public static final PolymorphicJsonAdapterFactory<RJSRunningTimeParameters> adapter = (
            PolymorphicJsonAdapterFactory.of(RJSRunningTimeParameters.class, "type")
                    .withSubtype(RJSRunningTimeParameters.Eco.class, "eco")
                    .withSubtype(RJSRunningTimeParameters.Margin.class, "margin")
    );

    /** Parameters for mareco (todo) */
    public static final class Eco extends RJSRunningTimeParameters {

    }

    public static final class Margin extends RJSRunningTimeParameters {
        @Json(name = "margin_type")
        public MarginType marginType;

        @Json(name = "margin_value")
        public double marginValue;

        public enum MarginType {
            TIME,
        }
    }


}
