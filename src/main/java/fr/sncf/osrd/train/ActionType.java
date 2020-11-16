package fr.sncf.osrd.train;

public enum ActionType {
    ACCELERATE(4),
    COASTING(3),
    BRAKE(2),
    EMERGENCY_BRAKING(1),
    DELETE_CONTROLLER(0);

    final int order;

    ActionType(int order) {
        this.order = order;
    }
}
