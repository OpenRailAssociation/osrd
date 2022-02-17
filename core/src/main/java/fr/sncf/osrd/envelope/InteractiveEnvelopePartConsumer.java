package fr.sncf.osrd.envelope;

/** An object capable of consuming integration steps. */
public interface InteractiveEnvelopePartConsumer {
    /** Initializes the envelope part metadata */
    boolean initEnvelopePart(double position, double speed, double direction);

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

    /** Sets the envelope part metadata */
    void setEnvelopePartMeta(EnvelopePartMeta meta);
}
