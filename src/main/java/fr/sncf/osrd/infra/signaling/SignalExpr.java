package fr.sncf.osrd.infra.signaling;

import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.simulation.Entity;
import fr.sncf.osrd.simulation.EntityType;

public abstract class SignalExpr {
    /**
     * Evaluates an expression, returning whether it's true or not
     * @param arguments the argument list of the function
     * @return whether the expression is true
     */
    public abstract boolean evaluate(Entity[] arguments);

    /** A type for the function that's called whenever a type reference is found */
    public interface DetectTypeCallback {
        void foundType(int index, EntityType type) throws InvalidInfraException;
    }

    public abstract void detectTypes(DetectTypeCallback callback) throws InvalidInfraException;

    public static final class SignalAspectCheck extends SignalExpr {
        /** The signal the condition checks for */
        public final int signalArgIndex;

        /** The condition is true when the signal has the following aspect */
        public final Aspect aspect;

        public SignalAspectCheck(
                int signalArgIndex,
                Aspect aspect
        ) {
            this.signalArgIndex = signalArgIndex;
            this.aspect = aspect;
        }

        @Override
        public boolean evaluate(Entity[] arguments) {
            var signalState = (Signal.State) arguments[signalArgIndex];
            return signalState.aspects.contains(aspect);
        }

        @Override
        public void detectTypes(DetectTypeCallback callback) throws InvalidInfraException {
            callback.foundType(signalArgIndex, EntityType.SIGNAL);
        }
    }

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
        public boolean evaluate(Entity[] arguments) {
            for (var expr : expressions)
                if (expr.evaluate(arguments))
                    return true;
            return false;
        }
    }


    public static final class AndExpr extends InfixOpExpr {
        public AndExpr(SignalExpr[] expressions) {
            super(expressions);
        }

        @Override
        public boolean evaluate(Entity[] arguments) {
            for (var expr : expressions)
                if (!expr.evaluate(arguments))
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
        public boolean evaluate(Entity[] arguments) {
            return !expression.evaluate(arguments);
        }

        @Override
        public void detectTypes(DetectTypeCallback callback) throws InvalidInfraException {
            expression.detectTypes(callback);
        }
    }
}
