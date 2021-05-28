package fr.sncf.osrd.railjson.schema.schedule;

import com.squareup.moshi.Json;
import com.squareup.moshi.adapters.PolymorphicJsonAdapterFactory;

public abstract class RJSRunningTimeParameters {
    public static final PolymorphicJsonAdapterFactory<RJSRunningTimeParameters> adapter = (
            PolymorphicJsonAdapterFactory.of(RJSRunningTimeParameters.class, "type")
                    .withSubtype(RJSRunningTimeParameters.Eco.class, "eco")
                    .withSubtype(Allowance.class, "allowance")
    );

    public static final class Eco extends RJSRunningTimeParameters {

    }

    public static final class Allowance extends RJSRunningTimeParameters {
        @Json(name = "allowance_type")
        public String allowanceType;

        @Json(name = "allowance_value")
        public double allowanceValue;
    }

}
