package fr.sncf.osrd.infra.railjson.schema.signaling;

import com.squareup.moshi.Json;
import com.squareup.moshi.adapters.PolymorphicJsonAdapterFactory;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.railjson.schema.ID;

import java.util.Map;

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
 *     <li>pattern matching on enum values</li>
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
 *         AspectSet{RED}
 *     } else if aspectset_contains(aspects, YELLOW) {
 *         AspectSet{YELLOW}
 *     } else {
 *         AspectSet{GREEN}
 *     }
 * }
 *
 * fn bal3_line_signal(
 *         master_signal: Signal,
 *         route: Route,
 * ) -> AspectSet {
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
 * ) -> AspectSet {
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
                    // boolean operators
                    .withSubtype(OrExpr.class, "or")
                    .withSubtype(AndExpr.class, "and")
                    .withSubtype(NotExpr.class, "not")
                    // value constructors
                    .withSubtype(TrueExpr.class, "true")
                    .withSubtype(FalseExpr.class, "false")
                    .withSubtype(AspectSetExpr.class, "aspect_set")
                    // control flow
                    .withSubtype(IfExpr.class, "condition")
                    .withSubtype(CallExpr.class, "call")
                    .withSubtype(EnumMatchExpr.class, "match")
                    // function-specific
                    .withSubtype(ArgumentRefExpr.class, "argument_ref")
                    // signals
                    .withSubtype(SignalAspectCheckExpr.class, "signal_has_aspect")
    );

    // region BOOLEAN_LOGIC

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

        public NotExpr(RJSSignalExpr expression) {
            this.expression = expression;
        }
    }

    // endregion

    // region VALUE_CONSTRUCTORS

    public static final class TrueExpr extends RJSSignalExpr {
        public TrueExpr() {
        }
    }

    public static final class FalseExpr extends RJSSignalExpr {
        public FalseExpr() {
        }
    }

    public static final class AspectSetExpr extends RJSSignalExpr {
        public static final class AspectSetMember {
            public final ID<RJSAspect> aspect;

            public final RJSSignalExpr condition;

            public AspectSetMember(ID<RJSAspect> aspect, RJSSignalExpr condition) {
                this.aspect = aspect;
                this.condition = condition;
            }
        }

        public final AspectSetMember[] members;

        public AspectSetExpr(AspectSetMember[] members) {
            this.members = members;
        }
    }

    // endregion

    // region CONTROL_FLOW

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

    public static final class CallExpr extends RJSSignalExpr {
        public final ID<RJSSignalFunction> function;

        public final RJSSignalExpr[] arguments;

        CallExpr(ID<RJSSignalFunction> function, RJSSignalExpr[] arguments) {
            this.function = function;
            this.arguments = arguments;
        }
    }

    public static final class EnumMatchExpr extends RJSSignalExpr {
        @Json(name = "branches")
        public final Map<String, RJSSignalExpr> branches;

        public EnumMatchExpr(Map<String, RJSSignalExpr> branches) {
            this.branches = branches;
        }
    }

    // endregion

    // region FUNCTION_SPECIFIC

    public static final class ArgumentRefExpr extends RJSSignalExpr {
        @Json(name = "argument_name")
        public final String argumentName;

        public ArgumentRefExpr(String argumentName) {
            this.argumentName = argumentName;
        }
    }

    // endregion

    // region SIGNALS

    /**
     * Returns whether some signal has a given aspect.
     * This rule can also test for the state of the signal being evaluated, if no signal name is given.
     */
    public static final class SignalAspectCheckExpr extends RJSSignalExpr {
        /**
         * The signal the condition checks for.
         * If no reference is given, the set of aspects of the signal being evaluated is used.
         */
        public final RJSSignalExpr signal;

        /** The condition is true when the signal has the following aspect */
        @Json(name = "has_aspect")
        public final ID<RJSAspect> hasAspect;

        public SignalAspectCheckExpr(RJSSignalExpr signal, ID<RJSAspect> hasAspect) {
            this.signal = signal;
            this.hasAspect = hasAspect;
        }
    }

    // endregion
}
