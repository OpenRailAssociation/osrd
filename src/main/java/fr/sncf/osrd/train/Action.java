package fr.sncf.osrd.train;

import java.util.Objects;

public class Action implements Comparable<Action> {
    private static final Action COAST;
    private static final Action EMERGENCY_BRAKING;

    static {
        COAST = new Action(ActionType.NO_ACTION);
        EMERGENCY_BRAKING = new Action(ActionType.EMERGENCY_BRAKING);
    }

    public enum ActionType {
        TRACTION(0, false),
        NO_ACTION(1, false),
        BRAKING(2, true),
        EMERGENCY_BRAKING(3, true);

        public final int priority;
        public final boolean deceleration;

        ActionType(int priority, boolean deceleration) {
            this.priority = priority;
            this.deceleration = deceleration;
        }

        public boolean isBreaking() {
            return this == BRAKING || this == EMERGENCY_BRAKING;
        }
    }

    /**
     * Gets the braking force
     * @return the braking force, or 0 if the action doesn't brake
     */
    public double brakingForce() {
        if (!type.isBreaking())
            return 0.0;
        return force;
    }

    /**
     * Gets the traction force
     * @return the traction force, or 0 if the action doesn't brake
     */
    public double tractionForce() {
        if (type != ActionType.TRACTION)
            return 0.0;
        return force;
    }

    final ActionType type;

    /**
     * Encodes the force the driver decided to apply, in newton.
     * It can be nan in case the action does not involve any force.
     */
    final double force;

    public static Action accelerate(double force) {
        return new Action(ActionType.TRACTION, force);
    }

    public static Action brake(double force) {
        assert force > 0.;
        return new Action(ActionType.BRAKING, force);
    }

    @SuppressWarnings("unused")
    public static Action emergencyBrake() {
        return EMERGENCY_BRAKING;
    }

    public static Action coast() {
        return COAST;
    }

    /**
     * Create a new force-less action.
     * @param type the kind of action
     */
    private Action(ActionType type) {
        this.type = type;
        this.force = Double.NaN;
    }

    boolean hasForce() {
        return !Double.isNaN(force);
    }

    /**
     * Create a new force action.
     * @param type the force to apply
     * @param force the force associated with the action
     */
    private Action(ActionType type, double force) {
        assert !Double.isNaN(force);
        this.type = type;
        this.force = force;
    }

    // region STD_OVERRIDES

    @Override
    public int compareTo(Action other) {
        // compare the level of emergency first.
        int cmp = Integer.compare(this.type.priority, other.type.priority);
        if (cmp != 0)
            return cmp;

        // if both have the same level of emergency, compare whether they have a force
        cmp = Boolean.compare(this.hasForce(), other.hasForce());
        if (cmp != 0)
            return cmp;

        // if neither actions have a force, they are equal (Nan isn't even equal to itself)
        if (Double.isNaN(force))
            return 0;

        // if both have a force and have same same level of emergency, compare by force
        // Accelerate 10 > Accelerate 20
        // Decelerate 20 > Decelerate 10
        if (type.deceleration)
            return Double.compare(this.force, other.force);
        return Double.compare(other.force, this.force);
    }

    @Override
    public boolean equals(Object obj) {
        if (!(obj instanceof Action))
            return false;
        return this.compareTo((Action) obj) == 0;
    }

    @Override
    public int hashCode() {
        return Objects.hash(type, force);
    }

    @Override
    public String toString() {
        return String.format("Action { type=%s, force=%f }",
                type.toString(), force);
    }

    // endregion
}
