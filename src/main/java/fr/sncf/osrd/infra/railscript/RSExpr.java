package fr.sncf.osrd.infra.railscript;

import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.infra.routegraph.Route;
import fr.sncf.osrd.infra.routegraph.RouteStatus;
import fr.sncf.osrd.infra.signaling.Aspect;
import fr.sncf.osrd.infra.signaling.Signal;
import fr.sncf.osrd.infra.railscript.value.*;

import java.util.Map;

public abstract class RSExpr<T extends RSValue> {
    /**
     * Evaluates an expression, returning whether it's true or not
     * @param infraState the state of the infrastructure
     * @param scope the argument list of the function
     * @return whether the expression is true
     */
    public abstract T evaluate(Infra.State infraState, RSValue[] scope);

    public abstract void accept(RSExprVisitor visitor) throws InvalidInfraException;

    public abstract RSValueType getType(RSValueType[] argumentTypes);

    // value constructors
    // TODO: support RJSSignalExpr.SwitchRefExpr

    // region BOOLEAN_OPERATORS

    /** Infix operators, like "or" and "and" apply to multiple expression */
    public abstract static class InfixOpExpr extends RSExpr<RSBool> {
        public final RSExpr<RSBool>[] expressions;

        public InfixOpExpr(RSExpr<RSBool>[] expressions) {
            this.expressions = expressions;
        }

        @Override
        public RSValueType getType(RSValueType[] argumentTypes) {
            return RSValueType.BOOLEAN;
        }

        @Override
        public void accept(RSExprVisitor visitor) throws InvalidInfraException {
            for (var expr : expressions)
                expr.accept(visitor);
        }
    }

    public static final class OrExpr extends InfixOpExpr {
        public OrExpr(RSExpr<RSBool>[] expressions) {
            super(expressions);
        }

        @Override
        public RSBool evaluate(Infra.State infraState, RSValue[] scope) {
            for (var expr : expressions)
                if (expr.evaluate(infraState, scope).value)
                    return RSBool.True;
            return RSBool.False;
        }

        @Override
        public void accept(RSExprVisitor visitor) throws InvalidInfraException {
            visitor.visit(this);
            super.accept(visitor);
        }
    }

    public static final class AndExpr extends InfixOpExpr {
        public AndExpr(RSExpr<RSBool>[] expressions) {
            super(expressions);
        }

        @Override
        public RSBool evaluate(Infra.State infraState, RSValue[] scope) {
            for (var expr : expressions)
                if (!expr.evaluate(infraState, scope).value)
                    return RSBool.True;
            return RSBool.False;
        }

        @Override
        public void accept(RSExprVisitor visitor) throws InvalidInfraException {
            visitor.visit(this);
            super.accept(visitor);
        }
    }

    public static final class NotExpr extends RSExpr<RSBool> {
        public final RSExpr<RSBool> expr;

        public NotExpr(RSExpr<RSBool> expr) {
            this.expr = expr;
        }

        @Override
        public RSBool evaluate(Infra.State infraState, RSValue[] scope) {
            return RSBool.from(!expr.evaluate(infraState, scope).value);
        }

        @Override
        public void accept(RSExprVisitor visitor) throws InvalidInfraException {
            visitor.visit(this);
            expr.accept(visitor);
        }

        @Override
        public RSValueType getType(RSValueType[] argumentTypes) {
            return RSValueType.BOOLEAN;
        }
    }

    // endregion

    // region VALUE_CONSTRUCTORS

    public static final class TrueExpr extends RSExpr<RSBool> {
        private TrueExpr() {
        }

        public static final TrueExpr INSTANCE = new TrueExpr();

        @Override
        public RSBool evaluate(Infra.State infraState, RSValue[] scope) {
            return RSBool.True;
        }

        @Override
        public RSValueType getType(RSValueType[] argumentTypes) {
            return RSValueType.BOOLEAN;
        }

        @Override
        public void accept(RSExprVisitor visitor) {
            visitor.visit(this);
        }
    }

    public static final class FalseExpr extends RSExpr<RSBool> {
        private FalseExpr() {
        }

        public static final FalseExpr INSTANCE = new FalseExpr();

        @Override
        public RSBool evaluate(Infra.State infraState, RSValue[] scope) {
            return RSBool.False;
        }

        @Override
        public RSValueType getType(RSValueType[] argumentTypes) {
            return RSValueType.BOOLEAN;
        }

        @Override
        public void accept(RSExprVisitor visitor) {
            visitor.visit(this);
        }
    }

    public static final class AspectSetExpr extends RSExpr<RSAspectSet> {
        public final Aspect[] aspects;
        public final RSExpr<RSBool>[] conditions;

        public AspectSetExpr(Aspect[] aspects, RSExpr<RSBool>[] conditions) {
            this.aspects = aspects;
            this.conditions = conditions;
        }

        @Override
        public RSAspectSet evaluate(Infra.State infraState, RSValue[] scope) {
            var res = new RSAspectSet();
            for (int i = 0; i < aspects.length; i++) {
                var condition = conditions[i];
                if (condition == null || condition.evaluate(infraState, scope).value)
                    res.add(aspects[i]);
            }
            return res;
        }

        @Override
        public RSValueType getType(RSValueType[] argumentTypes) {
            return RSValueType.ASPECT_SET;
        }

        @Override
        public void accept(RSExprVisitor visitor) throws InvalidInfraException {
            visitor.visit(this);
            for (var condition : conditions)
                condition.accept(visitor);
        }
    }

    public static final class SignalRefExpr extends RSExpr<Signal.State> {
        public final String signalName;

        private Signal signal = null;

        public SignalRefExpr(String signalName) {
            this.signalName = signalName;
        }

        /** Resolve the name of the signal reference into a signal */
        public void resolve(Map<String, Signal> signals) throws InvalidInfraException {
            signal = signals.get(signalName);
            if (signal == null)
                throw new InvalidInfraException("unknown signal " + signalName);
        }

        @Override
        public Signal.State evaluate(Infra.State infraState, RSValue[] scope) {
            return infraState.getState(signal);
        }

        @Override
        public RSValueType getType(RSValueType[] argumentTypes) {
            return RSValueType.SIGNAL;
        }

        @Override
        public void accept(RSExprVisitor visitor) throws InvalidInfraException {
            visitor.visit(this);
        }
    }

    public static final class RouteRefExpr extends RSExpr<Route.State> {
        public final String routeName;

        private Route route = null;

        public RouteRefExpr(String routeName) {
            this.routeName = routeName;
        }

        /** Resolve the name of the route reference into a route */
        public void resolve(Map<String, Route> routes) throws InvalidInfraException {
            route = routes.get(routeName);
            if (route == null)
                throw new InvalidInfraException("unknown route " + routeName);
        }

        @Override
        public Route.State evaluate(Infra.State infraState, RSValue[] scope) {
            return infraState.getState(route);
        }

        @Override
        public RSValueType getType(RSValueType[] argumentTypes) {
            return RSValueType.ROUTE;
        }

        @Override
        public void accept(RSExprVisitor visitor) throws InvalidInfraException {
            visitor.visit(this);
        }
    }

    // endregion

    // region CONTROL_FLOW

    public static final class IfExpr<T extends RSValue> extends RSExpr<T> {
        public final RSExpr<RSBool> ifExpr;
        public final RSExpr<T> thenExpr;
        public final RSExpr<T> elseExpr;

        /** A condition */
        public IfExpr(RSExpr<RSBool> ifExpr, RSExpr<T> thenExpr, RSExpr<T> elseExpr) {
            this.ifExpr = ifExpr;
            this.thenExpr = thenExpr;
            this.elseExpr = elseExpr;
        }

        @Override
        public T evaluate(Infra.State infraState, RSValue[] scope) {
            if (ifExpr.evaluate(infraState, scope).value) {
                return thenExpr.evaluate(infraState, scope);
            } else {
                return elseExpr.evaluate(infraState, scope);
            }
        }

        @Override
        public RSValueType getType(RSValueType[] argumentTypes) {
            return thenExpr.getType(argumentTypes);
        }

        @Override
        public void accept(RSExprVisitor visitor) throws InvalidInfraException {
            visitor.visit(this);
            ifExpr.accept(visitor);
            thenExpr.accept(visitor);
            elseExpr.accept(visitor);
        }
    }

    public static final class CallExpr<T extends RSValue> extends RSExpr<T> {
        public final RSFunction<T> function;
        public final RSExpr<?>[] arguments;

        public CallExpr(RSFunction<T> function, RSExpr<?>[] arguments) {
            this.function = function;
            this.arguments = arguments;
        }

        @Override
        public T evaluate(Infra.State infraState, RSValue[] scope) {
            var newScope = new RSValue[arguments.length];
            for (int i = 0; i < arguments.length; i++)
                newScope[i] = arguments[i].evaluate(infraState, scope);
            return function.body.evaluate(infraState, newScope);
        }

        @Override
        public RSValueType getType(RSValueType[] argumentTypes) {
            return this.function.returnsType;
        }

        @Override
        public void accept(RSExprVisitor visitor) throws InvalidInfraException {
            visitor.visit(this);
            for (var arg : arguments)
                arg.accept(visitor);
        }
    }

    public static final class EnumMatchExpr<T extends RSValue, CondT extends RSMatchable> extends RSExpr<T> {
        public final RSExpr<CondT> expr;
        public final RSExpr<T>[] branches;

        public EnumMatchExpr(RSExpr<CondT> expr, RSExpr<T>[] branches) {
            this.expr = expr;
            this.branches = branches;
        }

        @Override
        public T evaluate(Infra.State infraState, RSValue[] scope) {
            var branchIndex = expr.evaluate(infraState, scope).getEnumValue();
            return branches[branchIndex].evaluate(infraState, scope);
        }

        @Override
        public RSValueType getType(RSValueType[] argumentTypes) {
            return branches[0].getType(argumentTypes);
        }

        @Override
        public void accept(RSExprVisitor visitor) throws InvalidInfraException {
            visitor.visit(this);
            expr.accept(visitor);
            for (var branch : branches)
                branch.accept(visitor);
        }
    }

    // endregion

    // region FUNCTION_SPECIFIC

    public static final class ArgumentRefExpr<T extends RSValue> extends RSExpr<T> {
        public final int argumentIndex;

        public ArgumentRefExpr(int argumentIndex) {
            this.argumentIndex = argumentIndex;
        }

        @Override
        @SuppressWarnings("unchecked")
        public T evaluate(Infra.State infraState, RSValue[] scope) {
            return (T) scope[argumentIndex];
        }

        @Override
        public RSValueType getType(RSValueType[] argumentTypes) {
            return argumentTypes[argumentIndex];
        }

        @Override
        public void accept(RSExprVisitor visitor) throws InvalidInfraException {
            visitor.visit(this);
        }
    }

    // endregion

    // region PRIMITIVES

    public static final class SignalAspectCheckExpr extends RSExpr<RSBool> {
        /** The signal the condition checks for */
        public final RSExpr<Signal.State> signalExpr;

        /** The condition is true when the signal has the following aspect */
        public final Aspect aspect;

        public SignalAspectCheckExpr(RSExpr<Signal.State> signalExpr, Aspect aspect) {
            this.signalExpr = signalExpr;
            this.aspect = aspect;
        }

        @Override
        public RSBool evaluate(Infra.State infraState, RSValue[] scope) {
            var signal = signalExpr.evaluate(infraState, scope);
            return RSBool.from(signal.aspects.contains(aspect));
        }

        @Override
        public RSValueType getType(RSValueType[] argumentTypes) {
            return RSValueType.BOOLEAN;
        }

        @Override
        public void accept(RSExprVisitor visitor) throws InvalidInfraException {
            visitor.visit(this);
            signalExpr.accept(visitor);
        }
    }

    public static final class RouteStateCheckExpr extends RSExpr<RSBool> {
        public final RSExpr<Route.State> routeExpr;
        public final RouteStatus status;

        public RouteStateCheckExpr(RSExpr<Route.State> routeExpr, RouteStatus status) {
            this.routeExpr = routeExpr;
            this.status = status;
        }

        @Override
        public RSBool evaluate(Infra.State infraState, RSValue[] scope) {
            return RSBool.from(routeExpr.evaluate(infraState, scope).status == status);
        }

        @Override
        public RSValueType getType(RSValueType[] argumentTypes) {
            return RSValueType.BOOLEAN;
        }

        @Override
        public void accept(RSExprVisitor visitor) throws InvalidInfraException {
            visitor.visit(this);
        }
    }

    public static final class AspectSetContainsExpr extends RSExpr<RSBool> {
        public final RSExpr<RSAspectSet> expr;
        public final Aspect aspect;

        public AspectSetContainsExpr(RSExpr<RSAspectSet> expr, Aspect aspect) {
            this.expr = expr;
            this.aspect = aspect;
        }

        @Override
        public RSBool evaluate(Infra.State infraState, RSValue[] scope) {
            return RSBool.from(expr.evaluate(infraState, scope).contains(aspect));
        }

        @Override
        public RSValueType getType(RSValueType[] argumentTypes) {
            return RSValueType.BOOLEAN;
        }

        @Override
        public void accept(RSExprVisitor visitor) throws InvalidInfraException {
            visitor.visit(this);
            expr.accept(visitor);
        }
    }

    // endregion
}
