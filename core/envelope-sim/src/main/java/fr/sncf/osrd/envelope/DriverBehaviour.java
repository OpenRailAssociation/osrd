package fr.sncf.osrd.envelope;

public class DriverBehaviour {
    public double speedTransitionOffsetIncreasing = 0;
    public double speedTransitionOffsetDecreasing = 0;

    public DriverBehaviour(double speedTransitionOffsetIncreasing, double speedTransitionOffsetDecreasing) {
        this.speedTransitionOffsetIncreasing = speedTransitionOffsetIncreasing;
        this.speedTransitionOffsetDecreasing = speedTransitionOffsetDecreasing;
    }

    public DriverBehaviour() {
    }

    public double getSpeedTransitionOffsetIncreasing() {
        return speedTransitionOffsetIncreasing;
    }

    public double getSpeedTransitionOffsetDecreasing() {
        return speedTransitionOffsetDecreasing;
    }

    public void setSpeedTransitionOffsetIncreasing(double speedTransitionOffsetIncreasing) {
        this.speedTransitionOffsetIncreasing = speedTransitionOffsetIncreasing;
    }

    public void setSpeedTransitionOffsetDecreasing(double speedTransitionOffsetDecreasing) {
        this.speedTransitionOffsetDecreasing = speedTransitionOffsetDecreasing;
    }
}
