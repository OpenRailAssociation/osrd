package fr.sncf.osrd.envelope;

/** An object capable of consuming integration steps. */
public interface StepConsumer {
    /**
     * Adds an integration step to the result,
     * computing the time delta using the previous step.
     * @see #addStep(double, double, double)
     */
    boolean addStep(double position, double speed);

    /**
     * Adds an integration step to the result
     * @return whether the consumer will accept any more steps
     */
    boolean addStep(double position, double speed, double timeDelta);
}
