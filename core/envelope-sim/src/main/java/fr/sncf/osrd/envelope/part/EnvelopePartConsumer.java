package fr.sncf.osrd.envelope.part;

import fr.sncf.osrd.utils.SelfTypeHolder;

public interface EnvelopePartConsumer {
    /** Initializes the envelope part */
    void initEnvelopePart(double position, double speed, double direction);

    /**
     * Adds an integration step to the result, computing the time delta using the previous step.
     *
     * @see #addStep(double, double, double)
     */
    void addStep(double position, double speed);

    /** Adds an integration step to the result */
    void addStep(double position, double speed, double timeDelta);

    /** Sets an envelope part attribute */
    <T extends SelfTypeHolder> void setAttr(T attr);

    /** Sets envelope part attributes */
    void setAttrs(Iterable<SelfTypeHolder> attrs);
}
