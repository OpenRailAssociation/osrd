package fr.sncf.osrd.infra.signaling.expr;

import fr.sncf.osrd.infra.signaling.Aspect;
import fr.sncf.osrd.infra.signaling.Signal;
import fr.sncf.osrd.infra.signaling.expr.value.*;

public abstract class Expr<T extends IExprValue> {
    /**
     * Evaluates an expression, returning whether it's true or not
     * @param scope the argument list of the function
     * @return whether the expression is true
     */
    public abstract T evaluate(IExprValue[] scope);

    public abstract ValueType getType(ValueType[] argumentTypes);

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
    }

    public static final class OrExpr extends InfixOpExpr {
        public OrExpr(Expr<BooleanValue>[] expressions) {
            super(expressions);
        }

        @Override
        public BooleanValue evaluate(IExprValue[] scope) {
            for (var expr : expressions)
                if (expr.evaluate(scope).value)
                    return BooleanValue.True;
            return BooleanValue.False;
        }
    }

    public static final class AndExpr extends InfixOpExpr {
        public AndExpr(Expr<BooleanValue>[] expressions) {
            super(expressions);
        }

        @Override
        public BooleanValue evaluate(IExprValue[] scope) {
            for (var expr : expressions)
                if (!expr.evaluate(scope).value)
                    return BooleanValue.True;
            return BooleanValue.False;
        }
    }

    public static final class NotExpr extends Expr<BooleanValue> {
        public final Expr<BooleanValue> expression;

        public NotExpr(Expr<BooleanValue> expression) {
            this.expression = expression;
        }

        @Override
        public BooleanValue evaluate(IExprValue[] scope) {
            return BooleanValue.from(!expression.evaluate(scope).value);
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
        public BooleanValue evaluate(IExprValue[] scope) {
            return BooleanValue.True;
        }

        @Override
        public ValueType getType(ValueType[] argumentTypes) {
            return ValueType.BOOLEAN;
        }
    }

    public static final class FalseExpr extends Expr<BooleanValue> {
        private FalseExpr() {
        }

        public static final FalseExpr INSTANCE = new FalseExpr();

        @Override
        public BooleanValue evaluate(IExprValue[] scope) {
            return BooleanValue.False;
        }

        @Override
        public ValueType getType(ValueType[] argumentTypes) {
            return ValueType.BOOLEAN;
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
        public AspectSet evaluate(IExprValue[] scope) {
            var res = new AspectSet();
            for (int i = 0; i < aspects.length; i++) {
                var condition = conditions[i];
                if (condition == null || condition.evaluate(scope).value)
                    res.add(aspects[i]);
            }
            return res;
        }

        @Override
        public ValueType getType(ValueType[] argumentTypes) {
            return ValueType.ASPECT_SET;
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
        public T evaluate(IExprValue[] scope) {
            if (ifExpr.evaluate(scope).value) {
                return thenExpr.evaluate(scope);
            } else {
                return elseExpr.evaluate(scope);
            }
        }

        @Override
        public ValueType getType(ValueType[] argumentTypes) {
            return thenExpr.getType(argumentTypes);
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
        public T evaluate(IExprValue[] scope) {
            var newScope = new IExprValue[arguments.length];
            for (int i = 0; i < arguments.length; i++)
                newScope[i] = arguments[i].evaluate(scope);
            return function.body.evaluate(newScope);
        }

        @Override
        public ValueType getType(ValueType[] argumentTypes) {
            return this.function.returnsType;
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
        public T evaluate(IExprValue[] scope) {
            var branchIndex = expr.evaluate(scope).getEnumValue();
            return branches[branchIndex].evaluate(scope);
        }

        @Override
        public ValueType getType(ValueType[] argumentTypes) {
            return branches[0].getType(argumentTypes);
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
        public T evaluate(IExprValue[] scope) {
            return (T) scope[argumentIndex];
        }

        @Override
        public ValueType getType(ValueType[] argumentTypes) {
            return argumentTypes[argumentIndex];
        }
    }

    // endregion

    // region SIGNALS

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
        public BooleanValue evaluate(IExprValue[] scope) {
            var signal = signalExpr.evaluate(scope);
            return BooleanValue.from(signal.aspects.contains(aspect));
        }

        @Override
        public ValueType getType(ValueType[] argumentTypes) {
            return ValueType.BOOLEAN;
        }
    }

    // endregion
}
