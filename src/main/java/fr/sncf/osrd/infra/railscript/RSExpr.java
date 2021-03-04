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

    public abstract RSType getType(RSType[] argumentTypes);

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
        public RSType getType(RSType[] argumentTypes) {
            return RSType.BOOLEAN;
        }
    }

    public static final class Or extends InfixOpExpr {
        public Or(RSExpr<RSBool>[] expressions) {
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
        }
    }

    public static final class And extends InfixOpExpr {
        public And(RSExpr<RSBool>[] expressions) {
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
        }
    }

    public static final class Not extends RSExpr<RSBool> {
        public final RSExpr<RSBool> expr;

        public Not(RSExpr<RSBool> expr) {
            this.expr = expr;
        }

        @Override
        public RSBool evaluate(Infra.State infraState, RSValue[] scope) {
            return RSBool.from(!expr.evaluate(infraState, scope).value);
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
        public RSBool evaluate(Infra.State infraState, RSValue[] scope) {
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
        public RSBool evaluate(Infra.State infraState, RSValue[] scope) {
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
        public RSType getType(RSType[] argumentTypes) {
            return RSType.ASPECT_SET;
        }

        @Override
        public void accept(RSExprVisitor visitor) throws InvalidInfraException {
            visitor.visit(this);
        }
    }

    public static final class SignalRef extends RSExpr<Signal.State> {
        public final String signalName;

        private Signal signal = null;

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
        public Signal.State evaluate(Infra.State infraState, RSValue[] scope) {
            return infraState.getState(signal);
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

    public static final class RouteRef extends RSExpr<Route.State> {
        public final String routeName;

        private Route route = null;

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
        public Route.State evaluate(Infra.State infraState, RSValue[] scope) {
            return infraState.getState(route);
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
        public T evaluate(Infra.State infraState, RSValue[] scope) {
            if (ifExpr.evaluate(infraState, scope).value) {
                return thenExpr.evaluate(infraState, scope);
            } else {
                return elseExpr.evaluate(infraState, scope);
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

        public Call(RSFunction<T> function, RSExpr<?>[] arguments) {
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
        public T evaluate(Infra.State infraState, RSValue[] scope) {
            var branchIndex = expr.evaluate(infraState, scope).getEnumValue();
            return branches[branchIndex].evaluate(infraState, scope);
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

    // endregion

    // region FUNCTION_SPECIFIC

    public static final class ArgumentRef<T extends RSValue> extends RSExpr<T> {
        public final int argumentIndex;

        public ArgumentRef(int argumentIndex) {
            this.argumentIndex = argumentIndex;
        }

        @Override
        @SuppressWarnings("unchecked")
        public T evaluate(Infra.State infraState, RSValue[] scope) {
            return (T) scope[argumentIndex];
        }

        @Override
        public RSType getType(RSType[] argumentTypes) {
            return argumentTypes[argumentIndex];
        }

        @Override
        public void accept(RSExprVisitor visitor) throws InvalidInfraException {
            visitor.visit(this);
        }
    }

    // endregion

    // region PRIMITIVES

    public static final class SignalAspectCheck extends RSExpr<RSBool> {
        /** The signal the condition checks for */
        public final RSExpr<Signal.State> signalExpr;

        /** The condition is true when the signal has the following aspect */
        public final Aspect aspect;

        public SignalAspectCheck(RSExpr<Signal.State> signalExpr, Aspect aspect) {
            this.signalExpr = signalExpr;
            this.aspect = aspect;
        }

        @Override
        public RSBool evaluate(Infra.State infraState, RSValue[] scope) {
            var signal = signalExpr.evaluate(infraState, scope);
            return RSBool.from(signal.aspects.contains(aspect));
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
        public final RSExpr<Route.State> routeExpr;
        public final RouteStatus status;

        public RouteStateCheck(RSExpr<Route.State> routeExpr, RouteStatus status) {
            this.routeExpr = routeExpr;
            this.status = status;
        }

        @Override
        public RSBool evaluate(Infra.State infraState, RSValue[] scope) {
            return RSBool.from(routeExpr.evaluate(infraState, scope).status == status);
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
        public RSBool evaluate(Infra.State infraState, RSValue[] scope) {
            return RSBool.from(expr.evaluate(infraState, scope).contains(aspect));
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

    // endregion
}
