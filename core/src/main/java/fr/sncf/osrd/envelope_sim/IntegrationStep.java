package fr.sncf.osrd.envelope_sim;

public class IntegrationStep {
    public final double timeDelta;
    public final double positionDelta;
    public final double startSpeed;
    public final double endSpeed;
    public final double acceleration;
    public final double directionSign;

    private IntegrationStep(double timeDelta,
                            double positionDelta,
                            double startSpeed,
                            double endSpeed,
                            double acceleration,
                            double directionSign) {
        this.timeDelta = timeDelta;
        this.positionDelta = positionDelta;
        this.startSpeed = startSpeed;
        this.endSpeed = endSpeed;
        this.acceleration = acceleration;
        this.directionSign = directionSign;
    }

    /** Create a new integration step which always keeps positive speeds, from a step which may not */
    public static IntegrationStep fromNaiveStep(
            double timeDelta,
            double positionDelta,
            double startSpeed,
            double endSpeed,
            double acceleration,
            double directionSign
    ) {
        // if the end of the step dips below 0, cut the step in half
        if (endSpeed < 0.0) {
            assert directionSign * acceleration < 0.0;
            endSpeed = 0.0;
            // generic formula timeDelta = (endSpeed - startSpeed) / (directionSign * acceleration);
            timeDelta =  - startSpeed / (directionSign * acceleration);
            positionDelta = startSpeed * timeDelta + 0.5 * acceleration * timeDelta * timeDelta;
            positionDelta = Math.copySign(positionDelta, directionSign);
        }
        assert Math.abs(endSpeed - (startSpeed + directionSign * acceleration * timeDelta)) < 0.00000001;
        return new IntegrationStep(timeDelta, positionDelta, startSpeed, endSpeed, acceleration, directionSign);
    }


}
