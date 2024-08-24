package fr.sncf.osrd.envelope;

import fr.sncf.osrd.envelope.part.EnvelopePartConsumer;
import fr.sncf.osrd.utils.SelfTypeHolder;

public class NullEnvelopePartConsumer implements EnvelopePartConsumer {
    @Override
    public void initEnvelopePart(double position, double speed, double direction) {}

    @Override
    public void addStep(double position, double speed) {}

    @Override
    public void addStep(double position, double speed, double timeDelta) {}

    @Override
    public <T extends SelfTypeHolder> void setAttr(T attr) {}

    @Override
    public void setAttrs(Iterable<SelfTypeHolder> attrs) {}
}
