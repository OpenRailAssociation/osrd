package fr.sncf.osrd.infra.railjson.schema.signaling;

import com.squareup.moshi.Json;
import com.squareup.moshi.adapters.PolymorphicJsonAdapterFactory;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.railjson.schema.ID;
import fr.sncf.osrd.infra.railjson.schema.trackobjects.RJSSignal;

@SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
public abstract class RJSSignalExpr {
    public final PolymorphicJsonAdapterFactory<RJSSignalExpr> adapter = (
            PolymorphicJsonAdapterFactory.of(RJSSignalExpr.class, "type")
                    .withSubtype(SignalAspectCheck.class, "signal_aspect")
                    .withSubtype(OrExpr.class, "or")
                    .withSubtype(AndExpr.class, "and")
                    .withSubtype(NotExpr.class, "not")
    );

    public static final class SignalAspectCheck extends RJSSignalExpr {
        /** The signal the condition checks for */
        public final RJSSignalFunction.ParameterRef<RJSSignal> signal;

        /** The condition is true when the signal has the following aspect */
        @Json(name = "has_aspect")
        public final ID<RJSAspect> hasAspect;

        SignalAspectCheck(
                RJSSignalFunction.ParameterRef<RJSSignal> signal,
                ID<RJSAspect> hasAspect
        ) {
            this.signal = signal;
            this.hasAspect = hasAspect;
        }
    }

    public static final class OrExpr extends RJSSignalExpr {
        public final RJSSignalExpr[] expressions;

        OrExpr(
                RJSSignalExpr[] expressions
        ) {
            this.expressions = expressions;
        }
    }


    public static final class AndExpr extends RJSSignalExpr {
        public final RJSSignalExpr[] expressions;

        AndExpr(
                RJSSignalExpr[] expressions
        ) {
            this.expressions = expressions;
        }
    }

    public static final class NotExpr extends RJSSignalExpr {
        public final RJSSignalExpr expression;

        NotExpr(
                RJSSignalExpr expression
        ) {
            this.expression = expression;
        }
    }
}
