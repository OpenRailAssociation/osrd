package fr.sncf.osrd.infra.signaling;

import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.simulation.Entity;
import fr.sncf.osrd.simulation.EntityType;
import fr.sncf.osrd.utils.SortedArraySet;

public abstract class SignalExpr {
    /**
     * Evaluates an expression, returning whether it's true or not
     * @param arguments the argument list of the function
     * @return whether the expression is true
     */
    public abstract boolean evaluate(Entity[] arguments, SortedArraySet<Aspect> aspects);

    /** A type for the function that's called whenever a type reference is found */
    public interface DetectTypeCallback {
        void foundType(int index, EntityType type) throws InvalidInfraException;
    }

    public abstract void detectTypes(DetectTypeCallback callback) throws InvalidInfraException;

    // region SIGNALS

    public static final class SignalAspectCheckExpr extends SignalExpr {
        /** The signal the condition checks for */
        public final int signalArgIndex;

        /** The condition is true when the signal has the following aspect */
        public final Aspect aspect;

        public SignalAspectCheckExpr(int signalArgIndex, Aspect aspect) {
            this.signalArgIndex = signalArgIndex;
            this.aspect = aspect;
        }

        @Override
        public boolean evaluate(Entity[] arguments, SortedArraySet<Aspect> aspects) {
            var signalState = (Signal.State) arguments[signalArgIndex];
            return signalState.aspects.contains(aspect);
        }

        @Override
        public void detectTypes(DetectTypeCallback callback) throws InvalidInfraException {
            callback.foundType(signalArgIndex, EntityType.SIGNAL);
        }
    }

    public static final class SelfAspectCheckExpr extends SignalExpr {
        /** The condition is true when this signal has the following aspect */
        public final Aspect aspect;

        public SelfAspectCheckExpr(Aspect aspect) {
            this.aspect = aspect;
        }

        @Override
        public boolean evaluate(Entity[] arguments, SortedArraySet<Aspect> aspects) {
            return aspects.contains(aspect);
        }

        @Override
        public void detectTypes(DetectTypeCallback callback) {
        }
    }

    public static final class SetSignalAspectExpr extends SignalExpr {
        public final Aspect aspect;

        public SetSignalAspectExpr(Aspect aspect) {
            this.aspect = aspect;
        }

        @Override
        public boolean evaluate(Entity[] arguments, SortedArraySet<Aspect> aspects) {
            return aspects.add(aspect);
        }

        @Override
        public void detectTypes(DetectTypeCallback callback) {
        }
    }

    // endregion

    // region BOOLEAN_OPERATORS

    /** Infix operators, like "or" and "and" apply to multiple expression */
    public abstract static class InfixOpExpr extends SignalExpr {
        public final SignalExpr[] expressions;

        public InfixOpExpr(SignalExpr[] expressions) {
            this.expressions = expressions;
        }

        @Override
        public void detectTypes(DetectTypeCallback callback) throws InvalidInfraException {
            for (var expr : expressions)
                expr.detectTypes(callback);
        }
    }

    public static final class OrExpr extends InfixOpExpr {
        public OrExpr(SignalExpr[] expressions) {
            super(expressions);
        }

        @Override
        public boolean evaluate(Entity[] arguments, SortedArraySet<Aspect> aspects) {
            for (var expr : expressions)
                if (expr.evaluate(arguments, aspects))
                    return true;
            return false;
        }
    }

    public static final class AndExpr extends InfixOpExpr {
        public AndExpr(SignalExpr[] expressions) {
            super(expressions);
        }

        @Override
        public boolean evaluate(Entity[] arguments, SortedArraySet<Aspect> aspects) {
            for (var expr : expressions)
                if (!expr.evaluate(arguments, aspects))
                    return false;
            return true;
        }
    }

    public static final class NotExpr extends SignalExpr {
        public final SignalExpr expression;

        public NotExpr(SignalExpr expression) {
            this.expression = expression;
        }

        @Override
        public boolean evaluate(Entity[] arguments, SortedArraySet<Aspect> aspects) {
            return !expression.evaluate(arguments, aspects);
        }

        @Override
        public void detectTypes(DetectTypeCallback callback) throws InvalidInfraException {
            expression.detectTypes(callback);
        }
    }

    public static final class TrueExpr extends SignalExpr {
        public TrueExpr() {
        }

        @Override
        public boolean evaluate(Entity[] arguments, SortedArraySet<Aspect> aspects) {
            return true;
        }

        @Override
        public void detectTypes(DetectTypeCallback callback) {
        }
    }


    public static final class FalseExpr extends SignalExpr {
        public FalseExpr() {
        }

        @Override
        public boolean evaluate(Entity[] arguments, SortedArraySet<Aspect> aspects) {
            return false;
        }

        @Override
        public void detectTypes(DetectTypeCallback callback) {
        }
    }

    // endregion

    // region CONTROL_FLOW

    public static final class IfExpr extends SignalExpr {
        public final SignalExpr ifExpr;
        public final SignalExpr thenExpr;
        public final SignalExpr elseExpr;

        /** A condition */
        public IfExpr(SignalExpr ifExpr, SignalExpr thenExpr, SignalExpr elseExpr) {
            this.ifExpr = ifExpr;
            this.thenExpr = thenExpr;
            this.elseExpr = elseExpr;
        }

        @Override
        public boolean evaluate(Entity[] arguments, SortedArraySet<Aspect> aspects) {
            if (ifExpr.evaluate(arguments, aspects)) {
                return thenExpr.evaluate(arguments, aspects);
            } else {
                return elseExpr.evaluate(arguments, aspects);
            }
        }

        @Override
        public void detectTypes(DetectTypeCallback callback) throws InvalidInfraException {
            ifExpr.detectTypes(callback);
            thenExpr.detectTypes(callback);
            elseExpr.detectTypes(callback);
        }
    }

    // endregion
}
