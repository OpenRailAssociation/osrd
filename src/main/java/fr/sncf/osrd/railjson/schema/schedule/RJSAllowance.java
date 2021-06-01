package fr.sncf.osrd.railjson.schema.schedule;

import com.squareup.moshi.Json;
import com.squareup.moshi.adapters.PolymorphicJsonAdapterFactory;

public abstract class RJSAllowance {
    public static final PolymorphicJsonAdapterFactory<RJSAllowance> adapter = (
            PolymorphicJsonAdapterFactory.of(RJSAllowance.class, "type")
                    .withSubtype(Eco.class, "eco")
                    .withSubtype(LinearAllowance.class, "linear")
    );

    public static final class Eco extends RJSAllowance {

    }

    public static final class LinearAllowance extends RJSAllowance {
        @Json(name = "allowance_type")
        public String allowanceType;

        @Json(name = "allowance_value")
        public double allowanceValue;
    }

}
