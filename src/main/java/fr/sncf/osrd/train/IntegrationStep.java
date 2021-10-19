package fr.sncf.osrd.train;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;

/**
 * A class that represents one step of the integration process.
 * It's used when simulating the train, closely working with TrainPhysicsIntegrator.
 * Each step has a time duration, a position travelled, an acceleration and motor force
 * considered constant during the step, and a final speed, result of the physical formulas
 */
public class IntegrationStep {
    public final double timeDelta;
    public final double positionDelta;
    public final double finalSpeed;
    @SuppressFBWarnings("URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD")
    public final double acceleration;
    @SuppressFBWarnings("URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD")
    public final double tractionForce;

    /** Constructor of the class */
    public IntegrationStep(double timeDelta,
                           double positionDelta,
                           double finalSpeed,
                           double acceleration,
                           double motorForce) {
        this.timeDelta = timeDelta;
        this.positionDelta = positionDelta;
        this.finalSpeed = finalSpeed;
        this.acceleration = acceleration;
        this.tractionForce = motorForce;
    }
}
