package fr.sncf.osrd.envelope;

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
    public void setEnvelopePartMeta(EnvelopePartMeta meta) {
    }
}
