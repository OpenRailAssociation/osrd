package fr.sncf.osrd.infra.signaling.expr;

import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.infra.routegraph.Route;
import fr.sncf.osrd.infra.routegraph.RouteStatus;
import fr.sncf.osrd.infra.signaling.Aspect;
import fr.sncf.osrd.infra.signaling.Signal;
import fr.sncf.osrd.infra.signaling.expr.value.*;

import java.util.Map;

public abstract class Expr<T extends IExprValue> {
    /**
     * Evaluates an expression, returning whether it's true or not
     * @param infraState the state of the infrastructure
     * @param scope the argument list of the function
     * @return whether the expression is true
     */
    public abstract T evaluate(Infra.State infraState, IExprValue[] scope);

    public abstract void accept(ExprVisitor visitor) throws InvalidInfraException;

    public abstract ValueType getType(ValueType[] argumentTypes);

    // value constructors
    // TODO: support RJSSignalExpr.SwitchExpr

    // region BOOLEAN_OPERATORS

    /** Infix operators, like "or" and "and" apply to multiple expression */
    public abstract static class InfixOpExpr extends Expr<BooleanValue> {
        public final Expr<BooleanValue>[] expressions;

        public InfixOpExpr(Expr<BooleanValue>[] expressions) {
            this.expressions = expressions;
        }

        @Override
        public ValueType getType(ValueType[] argumentTypes) {
            return ValueType.BOOLEAN;
        }

        @Override
        public void accept(ExprVisitor visitor) throws InvalidInfraException {
            for (var expr : expressions)
                expr.accept(visitor);
        }
    }

    public static final class OrExpr extends InfixOpExpr {
        public OrExpr(Expr<BooleanValue>[] expressions) {
            super(expressions);
        }

        @Override
        public BooleanValue evaluate(Infra.State infraState, IExprValue[] scope) {
            for (var expr : expressions)
                if (expr.evaluate(infraState, scope).value)
                    return BooleanValue.True;
            return BooleanValue.False;
        }

        @Override
        public void accept(ExprVisitor visitor) throws InvalidInfraException {
            visitor.visit(this);
            super.accept(visitor);
        }
    }

    public static final class AndExpr extends InfixOpExpr {
        public AndExpr(Expr<BooleanValue>[] expressions) {
            super(expressions);
        }

        @Override
        public BooleanValue evaluate(Infra.State infraState, IExprValue[] scope) {
            for (var expr : expressions)
                if (!expr.evaluate(infraState, scope).value)
                    return BooleanValue.True;
            return BooleanValue.False;
        }

        @Override
        public void accept(ExprVisitor visitor) throws InvalidInfraException {
            visitor.visit(this);
            super.accept(visitor);
        }
    }

    public static final class NotExpr extends Expr<BooleanValue> {
        public final Expr<BooleanValue> expr;

        public NotExpr(Expr<BooleanValue> expr) {
            this.expr = expr;
        }

        @Override
        public BooleanValue evaluate(Infra.State infraState, IExprValue[] scope) {
            return BooleanValue.from(!expr.evaluate(infraState, scope).value);
        }

        @Override
        public void accept(ExprVisitor visitor) throws InvalidInfraException {
            visitor.visit(this);
            expr.accept(visitor);
        }

        @Override
        public ValueType getType(ValueType[] argumentTypes) {
            return ValueType.BOOLEAN;
        }
    }

    // endregion

    // region VALUE_CONSTRUCTORS

    public static final class TrueExpr extends Expr<BooleanValue> {
        private TrueExpr() {
        }

        public static final TrueExpr INSTANCE = new TrueExpr();

        @Override
        public BooleanValue evaluate(Infra.State infraState, IExprValue[] scope) {
            return BooleanValue.True;
        }

        @Override
        public ValueType getType(ValueType[] argumentTypes) {
            return ValueType.BOOLEAN;
        }

        @Override
        public void accept(ExprVisitor visitor) {
            visitor.visit(this);
        }
    }

    public static final class FalseExpr extends Expr<BooleanValue> {
        private FalseExpr() {
        }

        public static final FalseExpr INSTANCE = new FalseExpr();

        @Override
        public BooleanValue evaluate(Infra.State infraState, IExprValue[] scope) {
            return BooleanValue.False;
        }

        @Override
        public ValueType getType(ValueType[] argumentTypes) {
            return ValueType.BOOLEAN;
        }

        @Override
        public void accept(ExprVisitor visitor) {
            visitor.visit(this);
        }
    }

    public static final class AspectSetExpr extends Expr<AspectSet> {
        public final Aspect[] aspects;
        public final Expr<BooleanValue>[] conditions;

        public AspectSetExpr(Aspect[] aspects, Expr<BooleanValue>[] conditions) {
            this.aspects = aspects;
            this.conditions = conditions;
        }

        @Override
        public AspectSet evaluate(Infra.State infraState, IExprValue[] scope) {
            var res = new AspectSet();
            for (int i = 0; i < aspects.length; i++) {
                var condition = conditions[i];
                if (condition == null || condition.evaluate(infraState, scope).value)
                    res.add(aspects[i]);
            }
            return res;
        }

        @Override
        public ValueType getType(ValueType[] argumentTypes) {
            return ValueType.ASPECT_SET;
        }

        @Override
        public void accept(ExprVisitor visitor) throws InvalidInfraException {
            visitor.visit(this);
            for (var condition : conditions)
                condition.accept(visitor);
        }
    }

    public static final class SignalRefExpr extends Expr<Signal.State> {
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
        public Signal.State evaluate(Infra.State infraState, IExprValue[] scope) {
            return infraState.getState(signal);
        }

        @Override
        public ValueType getType(ValueType[] argumentTypes) {
            return ValueType.SIGNAL;
        }

        @Override
        public void accept(ExprVisitor visitor) throws InvalidInfraException {
            visitor.visit(this);
        }
    }

    public static final class RouteRefExpr extends Expr<Route.State> {
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
        public Route.State evaluate(Infra.State infraState, IExprValue[] scope) {
            return infraState.getState(route);
        }

        @Override
        public ValueType getType(ValueType[] argumentTypes) {
            return ValueType.ROUTE;
        }

        @Override
        public void accept(ExprVisitor visitor) throws InvalidInfraException {
            visitor.visit(this);
        }
    }

    // endregion

    // region CONTROL_FLOW

    public static final class IfExpr<T extends IExprValue> extends Expr<T> {
        public final Expr<BooleanValue> ifExpr;
        public final Expr<T> thenExpr;
        public final Expr<T> elseExpr;

        /** A condition */
        public IfExpr(Expr<BooleanValue> ifExpr, Expr<T> thenExpr, Expr<T> elseExpr) {
            this.ifExpr = ifExpr;
            this.thenExpr = thenExpr;
            this.elseExpr = elseExpr;
        }

        @Override
        public T evaluate(Infra.State infraState, IExprValue[] scope) {
            if (ifExpr.evaluate(infraState, scope).value) {
                return thenExpr.evaluate(infraState, scope);
            } else {
                return elseExpr.evaluate(infraState, scope);
            }
        }

        @Override
        public ValueType getType(ValueType[] argumentTypes) {
            return thenExpr.getType(argumentTypes);
        }

        @Override
        public void accept(ExprVisitor visitor) throws InvalidInfraException {
            visitor.visit(this);
            ifExpr.accept(visitor);
            thenExpr.accept(visitor);
            elseExpr.accept(visitor);
        }
    }

    public static final class CallExpr<T extends IExprValue> extends Expr<T> {
        public final Function<T> function;
        public final Expr<?>[] arguments;

        public CallExpr(Function<T> function, Expr<?>[] arguments) {
            this.function = function;
            this.arguments = arguments;
        }

        @Override
        public T evaluate(Infra.State infraState, IExprValue[] scope) {
            var newScope = new IExprValue[arguments.length];
            for (int i = 0; i < arguments.length; i++)
                newScope[i] = arguments[i].evaluate(infraState, scope);
            return function.body.evaluate(infraState, newScope);
        }

        @Override
        public ValueType getType(ValueType[] argumentTypes) {
            return this.function.returnsType;
        }

        @Override
        public void accept(ExprVisitor visitor) throws InvalidInfraException {
            visitor.visit(this);
            for (var arg : arguments)
                arg.accept(visitor);
        }
    }

    public static final class EnumMatchExpr<T extends IExprValue, CondT extends IMatchableValue> extends Expr<T> {
        public final Expr<CondT> expr;
        public final Expr<T>[] branches;

        public EnumMatchExpr(Expr<CondT> expr, Expr<T>[] branches) {
            this.expr = expr;
            this.branches = branches;
        }

        @Override
        public T evaluate(Infra.State infraState, IExprValue[] scope) {
            var branchIndex = expr.evaluate(infraState, scope).getEnumValue();
            return branches[branchIndex].evaluate(infraState, scope);
        }

        @Override
        public ValueType getType(ValueType[] argumentTypes) {
            return branches[0].getType(argumentTypes);
        }

        @Override
        public void accept(ExprVisitor visitor) throws InvalidInfraException {
            visitor.visit(this);
            expr.accept(visitor);
            for (var branch : branches)
                branch.accept(visitor);
        }
    }

    // endregion

    // region FUNCTION_SPECIFIC

    public static final class ArgumentRefExpr<T extends IExprValue> extends Expr<T> {
        public final int argumentIndex;

        public ArgumentRefExpr(int argumentIndex) {
            this.argumentIndex = argumentIndex;
        }

        @Override
        @SuppressWarnings("unchecked")
        public T evaluate(Infra.State infraState, IExprValue[] scope) {
            return (T) scope[argumentIndex];
        }

        @Override
        public ValueType getType(ValueType[] argumentTypes) {
            return argumentTypes[argumentIndex];
        }

        @Override
        public void accept(ExprVisitor visitor) throws InvalidInfraException {
            visitor.visit(this);
        }
    }

    // endregion

    // region PRIMITIVES

    public static final class SignalAspectCheckExpr extends Expr<BooleanValue> {
        /** The signal the condition checks for */
        public final Expr<Signal.State> signalExpr;

        /** The condition is true when the signal has the following aspect */
        public final Aspect aspect;

        public SignalAspectCheckExpr(Expr<Signal.State> signalExpr, Aspect aspect) {
            this.signalExpr = signalExpr;
            this.aspect = aspect;
        }

        @Override
        public BooleanValue evaluate(Infra.State infraState, IExprValue[] scope) {
            var signal = signalExpr.evaluate(infraState, scope);
            return BooleanValue.from(signal.aspects.contains(aspect));
        }

        @Override
        public ValueType getType(ValueType[] argumentTypes) {
            return ValueType.BOOLEAN;
        }

        @Override
        public void accept(ExprVisitor visitor) throws InvalidInfraException {
            visitor.visit(this);
            signalExpr.accept(visitor);
        }
    }

    public static final class RouteStateCheckExpr extends Expr<BooleanValue> {
        public final Expr<Route.State> routeExpr;
        public final RouteStatus status;

        public RouteStateCheckExpr(Expr<Route.State> routeExpr, RouteStatus status) {
            this.routeExpr = routeExpr;
            this.status = status;
        }

        @Override
        public BooleanValue evaluate(Infra.State infraState, IExprValue[] scope) {
            return BooleanValue.from(routeExpr.evaluate(infraState, scope).status == status);
        }

        @Override
        public ValueType getType(ValueType[] argumentTypes) {
            return ValueType.BOOLEAN;
        }

        @Override
        public void accept(ExprVisitor visitor) throws InvalidInfraException {
            visitor.visit(this);
        }
    }

    public static final class AspectSetContainsExpr extends Expr<BooleanValue> {
        public final Expr<AspectSet> expr;
        public final Aspect aspect;

        public AspectSetContainsExpr(Expr<AspectSet> expr, Aspect aspect) {
            this.expr = expr;
            this.aspect = aspect;
        }

        @Override
        public BooleanValue evaluate(Infra.State infraState, IExprValue[] scope) {
            return BooleanValue.from(expr.evaluate(infraState, scope).contains(aspect));
        }

        @Override
        public ValueType getType(ValueType[] argumentTypes) {
            return ValueType.BOOLEAN;
        }

        @Override
        public void accept(ExprVisitor visitor) throws InvalidInfraException {
            visitor.visit(this);
            expr.accept(visitor);
        }
    }

    // endregion
}
