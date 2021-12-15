package fr.sncf.osrd.envelope_sim;

public class IntegrationStep {
    public double timeDelta;
    public double positionDelta;
    public double endSpeed;
    public double acceleration;

    IntegrationStep(double timeDelta, double positionDelta, double endSpeed, double acceleration) {
        this.timeDelta = timeDelta;
        this.positionDelta = positionDelta;
        this.endSpeed = endSpeed;
        this.acceleration = acceleration;
    }
}
