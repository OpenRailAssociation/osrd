package fr.sncf.osrd.infra.signaling;

public abstract class AspectConstraint {

    public static class ConstraintPosition {
        public final double offset;
        public final ConstraintPosition.Element element;

        public enum Element {
            CURRENT_SIGNAL_SEEN,
            CURRENT_SIGNAL,
            NEXT_SIGNAL
        }

        public ConstraintPosition(double offset, ConstraintPosition.Element element) {
            this.offset = offset;
            this.element = element;
        }
    }

    public static class SpeedLimit extends AspectConstraint {
        public final double speed;
        public final ConstraintPosition appliesAt;

        public SpeedLimit(double speed, ConstraintPosition appliesAt) {
            this.speed = speed;
            this.appliesAt = appliesAt;
        }
    }
}
