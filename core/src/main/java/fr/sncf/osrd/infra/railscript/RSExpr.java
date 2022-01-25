package fr.sncf.osrd.infra.railscript;

import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.infra.railscript.value.*;
import fr.sncf.osrd.infra.routegraph.Route;
import fr.sncf.osrd.infra.signaling.Aspect;
import fr.sncf.osrd.infra.signaling.Signal;
import fr.sncf.osrd.infra.trackgraph.Switch;
import fr.sncf.osrd.infra_state.routes.RouteState;
import fr.sncf.osrd.infra_state.routes.RouteStatus;
import fr.sncf.osrd.infra_state.SignalState;
import fr.sncf.osrd.infra_state.SwitchState;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

public abstract class RSExpr<T extends RSValue> {
    /**
     * Evaluates an expression, returning whether it's true or not
     * @param state the global state of the program
     * @return whether the expression is true
     */
    public abstract T evaluate(RSExprState<?> state);

    public abstract void accept(RSExprVisitor visitor) throws InvalidInfraException;

    public abstract RSType getType(RSType[] argumentTypes);

    // region BOOLEAN_OPERATORS

    /** Infix operators, like "or" and "and" apply to multiple expression */
    public abstract static class InfixOpExpr extends RSExpr<RSBool> {
        public final RSExpr<RSBool>[] expressions;

        public InfixOpExpr(RSExpr<RSBool>[] expressions) {
            this.expressions = expressions;
        }

        @Override
        public RSType getType(RSType[] argumentTypes) {
            return RSType.BOOLEAN;
        }
    }

    public static final class Or extends InfixOpExpr {
        public Or(RSExpr<RSBool>[] expressions) {
            super(expressions);
        }

        @Override
        public RSBool evaluate(RSExprState<?> state) {
            var result = RSBool.False;
            // We cannot do lazy evaluation because of sides effects when evaluating delays
            for (var expr : expressions)
                if (expr.evaluate(state).value)
                    result = RSBool.True;
            return result;
        }

        @Override
        public void accept(RSExprVisitor visitor) throws InvalidInfraException {
            visitor.visit(this);
        }
    }

    public static final class And extends InfixOpExpr {
        public And(RSExpr<RSBool>[] expressions) {
            super(expressions);
        }

        @Override
        public RSBool evaluate(RSExprState<?> state) {
            var result = RSBool.True;
            for (var expr : expressions)
                if (!expr.evaluate(state).value)
                    result = RSBool.False;
            return result;
        }

        @Override
        public void accept(RSExprVisitor visitor) throws InvalidInfraException {
            visitor.visit(this);
        }
    }

    public static final class Not extends RSExpr<RSBool> {
        public final RSExpr<RSBool> expr;

        public Not(RSExpr<RSBool> expr) {
            this.expr = expr;
        }

        @Override
        public RSBool evaluate(RSExprState<?> state) {
            return RSBool.from(!expr.evaluate(state).value);
        }

        @Override
        public void accept(RSExprVisitor visitor) throws InvalidInfraException {
            visitor.visit(this);
        }

        @Override
        public RSType getType(RSType[] argumentTypes) {
            return RSType.BOOLEAN;
        }
    }

    // endregion

    // region VALUE_CONSTRUCTORS

    public static final class True extends RSExpr<RSBool> {
        private True() {
        }

        public static final True INSTANCE = new True();

        @Override
        public RSBool evaluate(RSExprState<?> state) {
            return RSBool.True;
        }

        @Override
        public RSType getType(RSType[] argumentTypes) {
            return RSType.BOOLEAN;
        }

        @Override
        public void accept(RSExprVisitor visitor) {
            visitor.visit(this);
        }
    }

    public static final class False extends RSExpr<RSBool> {
        private False() {
        }

        public static final False INSTANCE = new False();

        @Override
        public RSBool evaluate(RSExprState<?> state) {
            return RSBool.False;
        }

        @Override
        public RSType getType(RSType[] argumentTypes) {
            return RSType.BOOLEAN;
        }

        @Override
        public void accept(RSExprVisitor visitor) {
            visitor.visit(this);
        }
    }

    public static final class AspectSet extends RSExpr<RSAspectSet> {
        public final Aspect[] aspects;
        public final RSExpr<RSBool>[] conditions;

        public AspectSet(Aspect[] aspects, RSExpr<RSBool>[] conditions) {
            this.aspects = aspects;
            this.conditions = conditions;
        }

        @Override
        public RSAspectSet evaluate(RSExprState<?> state) {
            var res = new RSAspectSet();
            for (int i = 0; i < aspects.length; i++) {
                var condition = conditions[i];
                if (condition == null || condition.evaluate(state).value)
                    res.add(aspects[i]);
            }
            return res;
        }

        @Override
        public RSType getType(RSType[] argumentTypes) {
            return RSType.ASPECT_SET;
        }

        @Override
        public void accept(RSExprVisitor visitor) throws InvalidInfraException {
            visitor.visit(this);
        }
    }

    public static final class SignalRef extends RSExpr<SignalState> {
        public final String signalName;

        public Signal signal = null;

        public SignalRef(String signalName) {
            this.signalName = signalName;
        }

        /** Resolve the name of the signal reference into a signal */
        public void resolve(Map<String, Signal> signals) throws InvalidInfraException {
            signal = signals.get(signalName);
            if (signal == null)
                throw new InvalidInfraException("unknown signal " + signalName);
        }

        @Override
        public SignalState evaluate(
                RSExprState<?> state
        ) {
            return state.infraState.getSignalState(this.signal.index);
        }

        @Override
        public RSType getType(RSType[] argumentTypes) {
            return RSType.SIGNAL;
        }

        @Override
        public void accept(RSExprVisitor visitor) throws InvalidInfraException {
            visitor.visit(this);
        }
    }

    public static final class RouteRef extends RSExpr<RouteState> {
        public final String routeName;

        public Route route = null;

        public RouteRef(String routeName) {
            this.routeName = routeName;
        }

        /** Resolve the name of the route reference into a route */
        public void resolve(Map<String, Route> routes) throws InvalidInfraException {
            route = routes.get(routeName);
            if (route == null)
                throw new InvalidInfraException("unknown route " + routeName);
        }

        @Override
        public RouteState evaluate(RSExprState<?> state) {
            return state.infraState.getRouteState(route.index);
        }

        @Override
        public RSType getType(RSType[] argumentTypes) {
            return RSType.ROUTE;
        }

        @Override
        public void accept(RSExprVisitor visitor) throws InvalidInfraException {
            visitor.visit(this);
        }
    }

    public static final class SwitchRef extends RSExpr<SwitchState> {
        public final String switchName;

        public Switch switchRef = null;

        public SwitchRef(String switchName) {
            this.switchName = switchName;
        }

        /** Resolve the name of the route reference into a route */
        public void resolve(Map<String, Switch> switches) throws InvalidInfraException {
            switchRef = switches.get(switchName);
            if (switchRef == null)
                throw new InvalidInfraException("unknown switch " + switchName);
        }

        @Override
        public SwitchState evaluate(RSExprState<?> state) {
            return state.infraState.getSwitchState(switchRef.switchIndex);
        }

        @Override
        public RSType getType(RSType[] argumentTypes) {
            return RSType.SWITCH;
        }

        @Override
        public void accept(RSExprVisitor visitor) throws InvalidInfraException {
            visitor.visit(this);
        }
    }

    // endregion

    // region CONTROL_FLOW

    public static final class If<T extends RSValue> extends RSExpr<T> {
        public final RSExpr<RSBool> ifExpr;
        public final RSExpr<T> thenExpr;
        public final RSExpr<T> elseExpr;

        /** A condition */
        public If(RSExpr<RSBool> ifExpr, RSExpr<T> thenExpr, RSExpr<T> elseExpr) {
            this.ifExpr = ifExpr;
            this.thenExpr = thenExpr;
            this.elseExpr = elseExpr;
        }

        @Override
        public T evaluate(RSExprState<?> state) {
            var thenExprResult = thenExpr.evaluate(state);
            var elseExprResult = elseExpr.evaluate(state);
            if (ifExpr.evaluate(state).value) {
                return thenExprResult;
            } else {
                return elseExprResult;
            }
        }

        @Override
        public RSType getType(RSType[] argumentTypes) {
            return thenExpr.getType(argumentTypes);
        }

        @Override
        public void accept(RSExprVisitor visitor) throws InvalidInfraException {
            visitor.visit(this);
        }
    }

    public static final class Call<T extends RSValue> extends RSExpr<T> {
        public final RSFunction<T> function;
        public final RSExpr<?>[] arguments;
        public final int argScopeOffset;
        public final int delayScopeOffset;

        /** Creates an expression which calls a function */
        public Call(RSFunction<T> function, RSExpr<?>[] arguments, int argScopeOffset, int delayScopeOffset) {
            this.function = function;
            this.arguments = arguments;
            this.argScopeOffset = argScopeOffset;
            this.delayScopeOffset = delayScopeOffset;
        }

        @Override
        public T evaluate(RSExprState<?> state) {
            // evaluate the arguments outside of the scope
            for (int i = 0; i < arguments.length; i++)
                state.setArgValue(argScopeOffset + i, arguments[i].evaluate(state));

            // push the new scope and make the call
            state.pushScope(argScopeOffset, delayScopeOffset);
            var res = function.body.evaluate(state);
            state.popScope(argScopeOffset, delayScopeOffset);
            return res;
        }

        @Override
        public RSType getType(RSType[] argumentTypes) {
            return this.function.returnsType;
        }

        @Override
        public void accept(RSExprVisitor visitor) throws InvalidInfraException {
            visitor.visit(this);
        }
    }

    public static final class EnumMatch<T extends RSValue, CondT extends RSMatchable> extends RSExpr<T> {
        public final RSExpr<CondT> expr;
        public final RSExpr<T>[] branches;

        public EnumMatch(RSExpr<CondT> expr, RSExpr<T>[] branches) {
            this.expr = expr;
            this.branches = branches;
        }

        @Override
        public T evaluate(RSExprState<?> state) {
            var branchIndex = expr.evaluate(state).getEnumValue();
            T result = null;
            for (int i = 0; i < branches.length; i++) {
                var branchResult = branches[i].evaluate(state);
                if (i == branchIndex)
                    result = branchResult;
            }
            return result;
        }

        @Override
        public RSType getType(RSType[] argumentTypes) {
            return branches[0].getType(argumentTypes);
        }

        @Override
        public void accept(RSExprVisitor visitor) throws InvalidInfraException {
            visitor.visit(this);
        }
    }

    public static final class OptionalMatch<T extends RSValue> extends RSExpr<T> {
        public final RSExpr<RSOptional<T>> expr;
        public final RSExpr<T> caseNone;
        public final RSExpr<T> caseSome;
        public final String name;

        /** Matches an optional expression with an expression depending on its content */
        public OptionalMatch(RSExpr<RSOptional<T>> expr, RSExpr<T> caseNone, RSExpr<T> caseSome, String name)
                throws InvalidInfraException {
            this.expr = expr;
            this.caseNone = caseNone;
            this.caseSome = caseSome;
            this.name = name;

            var visitor = new NoDelayChecker();
            caseSome.accept(visitor);
        }

        @Override
        public T evaluate(RSExprState<?> state) {
            var optional = expr.evaluate(state);
            var caseNoneResult = caseNone.evaluate(state);
            if (optional.value == null)
                return caseNoneResult;
            else {
                state.variablesInScope.put(name, optional.value);
                var res = caseSome.evaluate(state);
                state.variablesInScope.remove(name);
                return res;
            }
        }

        private static class NoDelayChecker extends RSExprVisitor {
            public void visit(RSExpr.Delay<?> expr) throws InvalidInfraException {
                throw new InvalidInfraException("Delays cannot be used here");
            }
        }

        @Override
        public RSType getType(RSType[] argumentTypes) {
            return caseNone.getType(argumentTypes);
        }

        @Override
        public void accept(RSExprVisitor visitor) throws InvalidInfraException {
            visitor.visit(this);
        }
    }

    // endregion

    // region REFERENCES

    public static final class ArgumentRef<T extends RSValue> extends RSExpr<T> {
        public final int slotIndex;

        public ArgumentRef(int slotIndex) {
            this.slotIndex = slotIndex;
        }

        @Override
        @SuppressWarnings("unchecked")
        public T evaluate(RSExprState<?> state) {
            return (T) state.getArgValue(slotIndex);
        }

        @Override
        public RSType getType(RSType[] argumentTypes) {
            return argumentTypes[slotIndex];
        }

        @Override
        public void accept(RSExprVisitor visitor) {
            visitor.visit(this);
        }
    }

    public static final class OptionalMatchRef<T extends RSValue> extends RSExpr<T> {
        public final String name;
        public final RSType type;

        /** Refers to the content of an optional, in a "some" expression */
        public OptionalMatchRef(String name, HashMap<String, RSType> varTypes) throws InvalidInfraException {
            this.name = name;
            if (! varTypes.containsKey(name))
                throw new InvalidInfraException("can't find matching optional for name " + name);
            type = varTypes.get(name);
        }

        @Override
        @SuppressWarnings("unchecked")
        public T evaluate(RSExprState<?> state) {
            return (T) state.variablesInScope.get(name);
        }

        @Override
        public RSType getType(RSType[] argumentTypes) {
            return type;
        }

        @Override
        public void accept(RSExprVisitor visitor) {
            visitor.visit(this);
        }
    }

    // endregion

    // region PRIMITIVES

    public static final class Delay<T extends RSValue> extends RSExpr<T> {
        public final double duration;
        public final RSExpr<T> expr;
        public final int delaySlotIndex;

        /** A delay expression, which delays change propagation of expressions */
        public Delay(double duration, RSExpr<T> expr, int delaySlotIndex) {
            this.duration = duration;
            this.expr = expr;
            this.delaySlotIndex = delaySlotIndex;
        }

        @Override
        @SuppressWarnings({"unchecked", "fallthrough"})
        public T evaluate(RSExprState<?> state) {
            switch (state.evalMode) {
                case INITIALIZE: {
                    // when initializing, all values propagate instantaneously
                    T newValue = expr.evaluate(state);
                    state.setDelayCurrentValue(delaySlotIndex, newValue);
                    state.setDelayLaggingValue(delaySlotIndex, newValue);
                    return newValue;
                }
                case DELAY_UPDATE:
                    // if this slot received a planned update, we must return the value from the update
                    if (state.hasDelaySlotChanged(delaySlotIndex))
                        return (T) state.getDelayLaggingValue(delaySlotIndex);
                    // otherwise, behave as if the input changed
                    // FALLTHROUGH
                case INPUT_CHANGE:
                    T newValue = expr.evaluate(state);

                    // if the value of the expression changed, plan an update
                    if (!newValue.equals((T) state.getDelayCurrentValue(delaySlotIndex))) {
                        state.planDelayedUpdate(delaySlotIndex, newValue, duration);
                        state.setDelayCurrentValue(delaySlotIndex, newValue);
                    }
                    return (T) state.getDelayLaggingValue(delaySlotIndex);
            }
            return null;
        }

        @Override
        public RSType getType(RSType[] argumentTypes) {
            return expr.getType(argumentTypes);
        }

        @Override
        public void accept(RSExprVisitor visitor) throws InvalidInfraException {
            visitor.visit(this);
        }
    }

    public static final class SignalAspectCheck extends RSExpr<RSBool> {
        /** The signal the condition checks for */
        public final RSExpr<SignalState> signalExpr;

        /** The condition is true when the signal has the following aspect */
        public final Aspect aspect;

        public SignalAspectCheck(RSExpr<SignalState> signalExpr, Aspect aspect) {
            this.signalExpr = signalExpr;
            this.aspect = aspect;
        }

        @Override
        public RSBool evaluate(RSExprState<?> state) {
            var someSignal = signalExpr.evaluate(state);
            if (state.evalMode.equals(RSExprState.RSExprEvalMode.INITIALIZE))
                return RSBool.from(someSignal.signal.getInitialAspects().contains(aspect));
            else
                return RSBool.from(someSignal.aspects.contains(aspect));
        }

        @Override
        public RSType getType(RSType[] argumentTypes) {
            return RSType.BOOLEAN;
        }

        @Override
        public void accept(RSExprVisitor visitor) throws InvalidInfraException {
            visitor.visit(this);
        }
    }

    public static final class HasCBTCStatus extends RSExpr<RSBool> {
        public final RSExpr<RouteState> routeExpr;

        public HasCBTCStatus(RSExpr<RouteState> routeExpr) {
            this.routeExpr = routeExpr;
        }

        @Override
        public RSBool evaluate(RSExprState<?> state) {
            return RSBool.from(routeExpr.evaluate(state).hasCBTCStatus());
        }

        @Override
        public RSType getType(RSType[] argumentTypes) {
            return RSType.BOOLEAN;
        }

        @Override
        public void accept(RSExprVisitor visitor) throws InvalidInfraException {
            visitor.visit(this);
        }
    }

    public static final class IsPassiveRoute extends RSExpr<RSBool> {
        public final RSExpr<RouteState> routeExpr;

        public IsPassiveRoute(RSExpr<RouteState> routeExpr) {
            this.routeExpr = routeExpr;
        }

        @Override
        public RSBool evaluate(RSExprState<?> state) {
            return RSBool.from(!routeExpr.evaluate(state).route.isControlled());
        }

        @Override
        public RSType getType(RSType[] argumentTypes) {
            return RSType.BOOLEAN;
        }

        @Override
        public void accept(RSExprVisitor visitor) throws InvalidInfraException {
            visitor.visit(this);
        }
    }

    public static final class RouteStateCheck extends RSExpr<RSBool> {
        public final RSExpr<RouteState> routeExpr;
        public final RouteStatus status;

        public RouteStateCheck(RSExpr<RouteState> routeExpr, RouteStatus status) {
            this.routeExpr = routeExpr;
            this.status = status;
        }

        @Override
        public RSBool evaluate(RSExprState<?> state) {
            return RSBool.from(routeExpr.evaluate(state).status == status);
        }

        @Override
        public RSType getType(RSType[] argumentTypes) {
            return RSType.BOOLEAN;
        }

        @Override
        public void accept(RSExprVisitor visitor) throws InvalidInfraException {
            visitor.visit(this);
        }
    }

    public static final class AspectSetContains extends RSExpr<RSBool> {
        public final RSExpr<RSAspectSet> expr;
        public final Aspect aspect;

        public AspectSetContains(RSExpr<RSAspectSet> expr, Aspect aspect) {
            this.expr = expr;
            this.aspect = aspect;
        }

        @Override
        public RSBool evaluate(RSExprState<?> state) {
            return RSBool.from(expr.evaluate(state).contains(aspect));
        }

        @Override
        public RSType getType(RSType[] argumentTypes) {
            return RSType.BOOLEAN;
        }

        @Override
        public void accept(RSExprVisitor visitor) throws InvalidInfraException {
            visitor.visit(this);
        }
    }

    public static final class ReservedRoute extends RSExpr<RSOptional<RouteState>> {
        public final RSExpr<SignalState> signal;

        /** Contains all routes to test */
        final HashSet<Route> routeCandidates = new HashSet<>();

        public ReservedRoute(RSExpr<SignalState> signal) {
            this.signal = signal;
        }

        @Override
        public RSOptional<RouteState> evaluate(RSExprState<?> state) {
            var currentSignal = signal.evaluate(state).signal;
            RouteState matchingPassiveRoute = null;
            for (Route route : routeCandidates) {
                RouteState routeState = state.infraState.getRouteState(route.index);
                if (routeState.status == RouteStatus.RESERVED) {
                    if (routeState.route.entrySignal == currentSignal) {
                        return new RSOptional<>(routeState);
                    }
                }
                if (!route.isControlled() && route.entrySignal != null && route.entrySignal.id.equals(currentSignal.id))
                    matchingPassiveRoute = routeState;
            }

            // No explicitly reserved route, we return the passive route guarded by the signal (if any).
            // If there is no such passive route, it returns an empty optional
            return new RSOptional<>(matchingPassiveRoute);
        }

        @Override
        public RSType getType(RSType[] argumentTypes) {
            return RSType.OPTIONAL_ROUTE;
        }

        @Override
        public void accept(RSExprVisitor visitor) throws InvalidInfraException {
            visitor.visit(this);
        }
    }

    public static final class NextSignal extends RSExpr<RSOptional<SignalState>> {
        public final RSExpr<SignalState> signal;
        public final RSExpr<RouteState> route;
        public final RSExpr<RSAspectSet> withAspects;

        /** Constructor */
        public NextSignal(RSExpr<SignalState> signal, RSExpr<RouteState> route, RSExpr<RSAspectSet> withAspects) {
            this.signal = signal;
            this.route = route;
            this.withAspects = withAspects;
        }

        private boolean isSignalEligible(Signal signal, Set<String> aspects) {
            if (withAspects == null)
                return true;
            for (var aspect : aspects)
                if (signal.aspects.contains(aspect))
                    return true;
            return false;
        }

        public Signal findSignal(Route route, Signal signal, Set<String> aspects) {
            var indexCurrentSignal = route.signalsWithEntry.indexOf(signal);
            if (indexCurrentSignal >= 0) {
                for (int i = indexCurrentSignal + 1; i < route.signalsWithEntry.size(); i++) {
                    if (isSignalEligible(route.signalsWithEntry.get(i), aspects)) {
                        return route.signalsWithEntry.get(i);
                    }
                }
            }
            return null;
        }

        @Override
        public RSOptional<SignalState> evaluate(RSExprState<?> state) {
            var currentRoute = route.evaluate(state).route;
            var currentSignal = signal.evaluate(state).signal;
            var aspects = withAspects.evaluate(state).stream()
                    .map(aspect -> aspect.id)
                    .collect(Collectors.toSet());
            var resSignal = findSignal(currentRoute, currentSignal, aspects);
            if (resSignal == null)
                return new RSOptional<>(null);
            var resSignalState = state.infraState.getSignalState(resSignal.index);
            return new RSOptional<>(resSignalState);
        }

        @Override
        public RSType getType(RSType[] argumentTypes) {
            return RSType.OPTIONAL_SIGNAL;
        }

        @Override
        public void accept(RSExprVisitor visitor) throws InvalidInfraException {
            visitor.visit(this);
        }
    }

    
    public static final class PreviousReservedRoute extends RSExpr<RSOptional<RouteState>> {
        public final RSExpr<SignalState> signal;

        public PreviousReservedRoute(RSExpr<SignalState> signal) {
            this.signal = signal;
        }

        /**
         * Evaluate the expression to an optional route
         * @param state the global state of the program
         * @return the current reserved or occupied route preceding the signal, if any. Else an empty optional
         */
        @Override
        public RSOptional<RouteState> evaluate(RSExprState<?> state) {
            var currentSignal = signal.evaluate(state).signal;
            var routes = currentSignal.linkedDetector.getIncomingRouteNeighbors(
                    currentSignal.direction
                );
            for (var route : routes) {
                var routeState = state.infraState.getRouteState(route.index); 
                if (routeState.status == RouteStatus.RESERVED
                        || routeState.status == RouteStatus.OCCUPIED
                        || !route.isControlled()) {
                    return new RSOptional<>(routeState);
                }
            }
            return new RSOptional<>(null);
        }

        @Override
        public RSType getType(RSType[] argumentTypes) {
            return RSType.OPTIONAL_ROUTE;
        }

        @Override
        public void accept(RSExprVisitor visitor) throws InvalidInfraException {
            visitor.visit(this);
        }
    }

    // endregion
}
