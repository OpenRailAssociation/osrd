package fr.sncf.osrd.train;

import java.util.Objects;

public class Action implements Comparable<Action> {
    public enum ActionType {
        NO_ACTION(0),
        TRACTION(1),
        BRAKING(2),
        EMERGENCY_BRAKING(3);

        public final int priority;

        private ActionType(int priority) {
            this.priority = priority;
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

    /**
     * Whether to delete the speed controller.
     */
    final boolean deleteController;

    public static Action accelerate(double force, boolean deleteController) {
        assert force > 0.;
        return new Action(ActionType.TRACTION, force, deleteController);
    }

    public static Action brake(double force, boolean deleteController) {
        return new Action(ActionType.BRAKING, force, deleteController);
    }

    public static Action emergencyBrake(boolean deleteController) {
        return new Action(ActionType.EMERGENCY_BRAKING, deleteController);
    }

    public static Action empty(boolean deleteController) {
        return new Action(ActionType.NO_ACTION, deleteController);
    }

    /**
     * Create a new force-less action.
     * @param deleteController whether to delete the controller
     */
    private Action(ActionType type, boolean deleteController) {
        this.type = type;
        this.force = Double.NaN;
        this.deleteController = deleteController;
    }

    boolean hasForce() {
        return !Double.isNaN(force);
    }

    /**
     * Create a new force action.
     * @param force the force to apply
     * @param deleteController whether to delete the controller
     */
    private Action(ActionType type, double force, boolean deleteController) {
        this.type = type;
        this.force = force;
        this.deleteController = deleteController;
    }

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
        return Double.compare(this.force, other.force);
    }

    @Override
    public boolean equals(Object obj) {
        if (!(obj instanceof Action))
            return false;
        return this.compareTo((Action)obj) == 0;
    }

    @Override
    public int hashCode() {
        return Objects.hash(type, force, deleteController);
    }
}
