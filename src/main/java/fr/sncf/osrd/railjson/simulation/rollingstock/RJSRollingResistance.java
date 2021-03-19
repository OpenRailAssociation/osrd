package fr.sncf.osrd.railjson.simulation.rollingstock;

import com.squareup.moshi.adapters.PolymorphicJsonAdapterFactory;

public abstract class RJSRollingResistance {
    public static final PolymorphicJsonAdapterFactory<RJSRollingResistance> adapter = (
            PolymorphicJsonAdapterFactory.of(RJSRollingResistance.class, "type")
                    .withSubtype(RJSRollingResistance.Davis.class, "davis")
    );

    public static final class Davis extends RJSRollingResistance {
        /** in newtons */
        public final double A;

        /** in newtons / (m/s) */
        public final double B;

        /** in newtons / (m/s^2) */
        public final double C;

        /** Creates a Davis rolling resistance formula */
        public Davis(double a, double b, double c) {
            A = a;
            B = b;
            C = c;
        }
    }
}
