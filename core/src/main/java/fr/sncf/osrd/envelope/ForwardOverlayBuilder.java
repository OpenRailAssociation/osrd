package fr.sncf.osrd.envelope;

public final class ForwardOverlayBuilder extends EnvelopeOverlayBuilder {
    public ForwardOverlayBuilder(Envelope base) {
        super(base);
    }

    @Override
    protected int initialPartIndex() {
        return 0;
    }

    @Override
    protected int initialStepIndex(EnvelopePart part) {
        return 0;
    }

    @Override
    protected EnvelopePart smartSlice(int beginStepIndex, double beginPosition, int endStepIndex, double endPosition) {
        return part.smartSlice(beginStepIndex, beginPosition, endStepIndex, endPosition);
    }

    @Override
    protected int nextPartIndex() {
        int res = partIndex + 1;
        if (res >= base.size())
            return -1;
        return res;
    }

    @Override
    protected int nextStepIndex() {
        int res = stepIndex + 1;
        if (res >= part.stepCount())
            return -1;
        return res;
    }

    @Override
    protected double getBaseStepBegin() {
        return part.getBeginPos(stepIndex);
    }

    @Override
    protected double getBaseStepEnd() {
        return part.getEndPos(stepIndex);
    }

    @Override
    protected double getBaseStepBeginSpeed() {
        return part.getBeginSpeed(stepIndex);
    }

    @Override
    protected double getBaseStepEndSpeed() {
        return part.getEndSpeed(stepIndex);
    }

    @Override
    protected double dirCmp(double a, double b) {
        return a - b;
    }

    @Override
    protected Envelope makeEnvelope(EnvelopePart[] parts) {
        return Envelope.make(parts);
    }

    @Override
    protected EnvelopePart buildEnvelopePart(EnvelopePartBuilder builder) {
        return builder.build();
    }
}
