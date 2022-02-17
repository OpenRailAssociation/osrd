package fr.sncf.osrd.envelope;

public interface EnvelopePartConsumer {
    /** Initializes the envelope part */
    void initEnvelopePart(double position, double speed, double direction);

    /**
     * Adds an integration step to the result, computing the time delta using the previous step.
     * @see #addStep(double, double, double)
     */
    void addStep(double position, double speed);

    /** Adds an integration step to the result */
    void addStep(double position, double speed, double timeDelta);

    /** Finalizes a envelope part */
    void setEnvelopePartMeta(EnvelopePartMeta meta);
}
