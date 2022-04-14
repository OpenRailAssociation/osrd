package fr.sncf.osrd.envelope;

import fr.sncf.osrd.envelope.part.EnvelopePartConsumer;

public class NullEnvelopePartConsumer implements EnvelopePartConsumer {
    @Override
    public void initEnvelopePart(double position, double speed, double direction) {
    }

    @Override
    public void addStep(double position, double speed) {
    }

    @Override
    public void addStep(double position, double speed, double timeDelta) {
    }

    @Override
    public <T extends EnvelopeAttr> void setAttr(T attr) {
    }

    @Override
    public void setAttrs(Iterable<EnvelopeAttr> attrs) {
    }
}
