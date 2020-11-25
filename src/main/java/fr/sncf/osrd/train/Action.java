package fr.sncf.osrd.train;

import java.util.Objects;

public class Action implements Comparable<Action> {
    /**
     * Encodes the force the driver decided to apply, in newton.
     * It can be nan in case the action does not involve any force.
     */
    final double force;

    /**
     * Whether the action is an emergency event.
     */
    final boolean emergencyBrake;

    /**
     * Whether to delete the speed controller.
     */
    final boolean deleteController;

    /**
     * Whether the action actually does something.
     */
    final boolean noAction;

    public static Action accelerate(double force, boolean deleteController) {
        return new Action(force, false, deleteController);
    }

    public static Action brake(double force, boolean deleteController) {
        return new Action(force, false, deleteController);
    }

    public static Action emergencyBrake(boolean deleteController) {
        return new Action(true, deleteController);
    }

    public static Action empty(boolean deleteController) {
        return new Action(deleteController);
    }

    /**
     * Create a new force-less action.
     * @param emergencyBrake whether the action is an emergency event
     * @param deleteController whether to delete the controller
     */
    private Action(boolean emergencyBrake, boolean deleteController) {
        this.force = Double.NaN;
        this.emergencyBrake = emergencyBrake;
        this.deleteController = deleteController;
        this.noAction = false;
    }

    boolean hasForce() {
        return !Double.isNaN(force);
    }

    /**
     * Create a new force action.
     * @param force the force to apply
     * @param emergencyBrake whether the action is an emergency event
     * @param deleteController whether to delete the controller
     */
    private Action(double force, boolean emergencyBrake, boolean deleteController) {
        this.force = force;
        this.emergencyBrake = emergencyBrake;
        this.deleteController = deleteController;
        this.noAction = false;
    }

    /**
     * Create a new empty action.
     * @param deleteController whether to delete the controller
     */
    private Action(boolean deleteController) {
        this.force = Double.NaN;
        this.emergencyBrake = false;
        this.deleteController = deleteController;
        this.noAction = true;
    }

    @Override
    public int compareTo(Action other) {
        // compare the level of emergency first.
        int cmp = Boolean.compare(this.emergencyBrake, other.emergencyBrake);
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
        return Objects.hash(force, emergencyBrake, deleteController, noAction);
    }
}
