package fr.sncf.osrd.envelope;

public final class BackwardOverlayBuilder extends EnvelopeOverlayBuilder {
    public BackwardOverlayBuilder(Envelope base) {
        super(base);
    }

    @Override
    protected int initialPartIndex() {
        return base.size() - 1;
    }

    @Override
    protected int initialStepIndex(EnvelopePart part) {
        return part.stepCount() - 1;
    }

    @Override
    protected EnvelopePart smartSlice(int beginStepIndex, double beginPosition, int endStepIndex, double endPosition) {
        return part.smartSlice(endStepIndex, endPosition, beginStepIndex, beginPosition);
    }

    @Override
    protected int nextPartIndex() {
        int res = partIndex - 1;
        if (res < 0)
            return -1;
        return res;
    }

    @Override
    protected int nextStepIndex() {
        int res = stepIndex - 1;
        if (res < 0)
            return -1;
        return res;
    }

    @Override
    protected double getBaseStepBegin() {
        return part.getEndPos(stepIndex);
    }

    @Override
    protected double getBaseStepEnd() {
        return part.getBeginPos(stepIndex);
    }

    @Override
    protected double getBaseStepBeginSpeed() {
        return part.getEndSpeed(stepIndex);
    }

    @Override
    protected double getBaseStepEndSpeed() {
        return part.getBeginSpeed(stepIndex);
    }

    @Override
    protected double dirCmp(double a, double b) {
        return b - a;
    }

    @Override
    protected Envelope makeEnvelope(EnvelopePart[] parts) {
        for (int i = 0; i < parts.length / 2; i++) {
            var tmp = parts[i];
            parts[i] = parts[parts.length - i - 1];
            parts[parts.length - i - 1] = tmp;
        }
        return Envelope.make(parts);
    }

    @Override
    protected EnvelopePart buildEnvelopePart(EnvelopePartBuilder builder) {
        builder.reverse();
        return builder.build();
    }
}
