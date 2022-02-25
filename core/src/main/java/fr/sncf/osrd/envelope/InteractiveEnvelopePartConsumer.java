package fr.sncf.osrd.envelope;

import java.util.Map;

/** An object capable of consuming integration steps. */
public interface InteractiveEnvelopePartConsumer {
    /** Initializes the envelope part metadata */
    boolean initEnvelopePart(double position, double speed, double direction);

    /** Returns the position of the last data point */
    double getLastPos();

    /** Returns the speed of the last data point */
    double getLastSpeed();

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

    /** Sets an envelope part attribute */
    <T extends EnvelopeAttr> void setAttr(T attr);

    /** Sets envelope part attributes */
    void setAttrs(Iterable<EnvelopeAttr> attrs);
}
