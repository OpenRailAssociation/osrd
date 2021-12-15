package fr.sncf.osrd.standalone_sim;

public class IntegrationStep {
    public double speed;
    public double acceleration;
    public double timeDelta;
    public double positionDelta;

    public IntegrationStep(double timeDelta, double positionDelta, double speed, double acceleration) {
        this.timeDelta = timeDelta;
        this.positionDelta = positionDelta;
        this.speed = speed;
        this.acceleration = acceleration;
    }
}
