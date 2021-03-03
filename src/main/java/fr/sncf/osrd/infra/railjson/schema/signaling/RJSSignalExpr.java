package fr.sncf.osrd.infra.railjson.schema.signaling;

import com.squareup.moshi.Json;
import com.squareup.moshi.adapters.PolymorphicJsonAdapterFactory;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.railjson.schema.ID;
import fr.sncf.osrd.infra.railjson.schema.trackobjects.RJSSignal;

/**
 * <h1>SignalScript</h1>
 * <p>SignalScript has support for:</p>
 * <ul>
 *     <li>
 *         <p>data types:</p>
 *         <ul>
 *             <li>boolean</li>
 *             <li>AspectSet</li>
 *             <li>Signal (matchable)</li>
 *             <li>Route (matchable)</li>
 *             <li>Switch (matchable)</li>
 *         </ul>
 *     </li>
 *     <li>functions and function calls, in a strictly non recursive fashion
 *         (functions can only call already declared functions)</li>
 *     <li>purely functional conditions (mandatory else)</li>
 *     <li>a set comprehension construct for building AspectSet</li>
 * </ul>
 *
 * <p>Some caveats:</p>
 * <ul>
 *     <li>no loops</li>
 *     <li>no variables</li>
 *     <li>no recursion</li>
 * </ul>
 *
 * <h2>Source code example</h2>
 * <b>No parser for this language is planned yet, it's only there to help understand things better</b>
 *
 * <pre>
 * {@code
 *
 * fn sncf_filter(aspects: AspectSet) -> AspectSet {
 *     if aspectset_contains(aspects, RED) {
 *         SignalSet{RED}
 *     } else if signalset_contains(aspects, YELLOW) {
 *         SignalSet{YELLOW}
 *     } else {
 *         SignalSet{GREEN}
 *     }
 * }
 *
 * fn bal3_line_signal(
 *         master_signal: Signal,
 *         route: Route,
 * ) -> SignalSet {
 *     sncf_filter(AspectSet{
 *         RED if route_has_state(route, OCCUPIED),
 *         YELLOW if signal_has_aspect(master_signal, RED),
 *         GREEN
 *     })
 * }
 *
 * fn switch_bal3_signal(
 *         switch: Switch,
 *         left_master_signal: Signal,
 *         right_master_signal: Signal,
 *         left_route: Route,
 *         right_route: Route
 * ) -> SignalSet {
 *     match switch {
 *         LEFT: bal3_line_signal(left_master_signal, left_route)
 *         RIGHT: bal3_line_signal(right_master_signal, right_route)
 *     }
 * }
 *
 * Signal {
 *     expr: bal3_line_signal(master_signal: "test_signal_foo", route: "test_route_bar")
 * }
 *
 * }
 * </pre>
 */
@SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
public abstract class RJSSignalExpr {
    public static final PolymorphicJsonAdapterFactory<RJSSignalExpr> adapter = (
            PolymorphicJsonAdapterFactory.of(RJSSignalExpr.class, "type")
                    .withSubtype(SignalAspectCheckExpr.class, "has_aspect")
                    .withSubtype(SetAspectExpr.class, "set_aspect")
                    .withSubtype(OrExpr.class, "or")
                    .withSubtype(AndExpr.class, "and")
                    .withSubtype(NotExpr.class, "not")
                    .withSubtype(IfExpr.class, "condition")
                    .withSubtype(TrueExpr.class, "true")
                    .withSubtype(FalseExpr.class, "false")
    );

    /**
     * Returns whether some signal has a given aspect.
     * This rule can also test for the state of the signal being evaluated, if no signal name is given.
     */
    public static final class SignalAspectCheckExpr extends RJSSignalExpr {
        /**
         * The signal the condition checks for.
         * If no reference is given, the set of aspects of the signal being evaluated is used.
         */
        public final RJSSignalFunction.ArgumentRef<RJSSignal> signal;

        /** The condition is true when the signal has the following aspect */
        @Json(name = "has_aspect")
        public final ID<RJSAspect> hasAspect;

        public SignalAspectCheckExpr(RJSSignalFunction.ArgumentRef<RJSSignal> signal, ID<RJSAspect> hasAspect) {
            this.signal = signal;
            this.hasAspect = hasAspect;
        }
    }

    /** Sets a given aspect and returns true if it wasn't already set */
    public static final class SetAspectExpr extends RJSSignalExpr {
        @Json(name = "aspect")
        public final ID<RJSAspect> aspect;

        public SetAspectExpr(ID<RJSAspect> aspect) {
            this.aspect = aspect;
        }
    }

    public static final class IfExpr extends RJSSignalExpr {
        @Json(name = "if")
        public final RJSSignalExpr condition;

        @Json(name = "then")
        public final RJSSignalExpr branchTrue;

        @Json(name = "else")
        public final RJSSignalExpr branchFalse;

        /** If the "if" expression returns true, run the "then" branch. Otherwise, run the "else" branch. */
        public IfExpr(RJSSignalExpr condition, RJSSignalExpr branchTrue, RJSSignalExpr branchFalse) {
            this.condition = condition;
            this.branchTrue = branchTrue;
            this.branchFalse = branchFalse;
        }
    }

    public abstract static class InfixOpExpr extends RJSSignalExpr {
        public final RJSSignalExpr[] expressions;

        public InfixOpExpr(RJSSignalExpr[] expressions) {
            this.expressions = expressions;
        }
    }

    public static final class OrExpr extends InfixOpExpr {
        public OrExpr(RJSSignalExpr[] expressions) {
            super(expressions);
        }
    }

    public static final class AndExpr extends InfixOpExpr {
        public AndExpr(RJSSignalExpr[] expressions) {
            super(expressions);
        }
    }

    public static final class NotExpr extends RJSSignalExpr {
        public final RJSSignalExpr expression;

        NotExpr(RJSSignalExpr expression) {
            this.expression = expression;
        }
    }

    public static final class TrueExpr extends RJSSignalExpr {
        TrueExpr() {
        }
    }

    public static final class FalseExpr extends RJSSignalExpr {
        FalseExpr() {
        }
    }
}
