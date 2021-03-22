package fr.sncf.osrd.railjson.schema.rollingstock;

import com.squareup.moshi.adapters.PolymorphicJsonAdapterFactory;

public abstract class RJSRollingResistance {
    public static final PolymorphicJsonAdapterFactory<RJSRollingResistance> adapter = (
            PolymorphicJsonAdapterFactory.of(RJSRollingResistance.class, "type")
                    .withSubtype(RJSRollingResistance.Davis.class, "davis")
    );

    /** <p>The Davis equation is a simple expression of the train's rolling resistance f(velocity)</p>

     <pre>R = A + B * v + C * v^2</pre>

     <pre>
     {@code
     /!\ Be careful when importing data, conversions are needed /!\

     A = cfg.getDouble("A") * mass / 100.0; // from dN/ton to N
     B = cfg.getDouble("B") * mass / 100 * 3.6D; // from dN/ton/(km/h) to N
     C = cfg.getDouble("C") * mass / 100 * Math.pow(3.6D, 2); // from dN/ton/(km/h)2 to N

     A = json.getDouble("coeffvoma") * 10; // from dN to N
     B = json.getDouble("coeffvomb") * 10 * 3.6D; // from dN/(km/h) to N/(m/s)
     C = json.getDouble("coeffvomc") * 10 * Math.pow(3.6D, 2); // from dN/(km/h)2 to N/(m/s)2
     }
     </pre>
    */
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
