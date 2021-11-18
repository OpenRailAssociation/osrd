package fr.sncf.osrd.envelope;

public enum EnvelopeType {
    TRAIN_LIMIT(EnvelopeKind.STATIC),
    TRACK_LIMIT(EnvelopeKind.STATIC),
    ECO(EnvelopeKind.ECO),
    DYNAMIC(EnvelopeKind.DYNAMIC),
    ;

    public final EnvelopeKind kind;

    EnvelopeType(EnvelopeKind kind) {
        this.kind = kind;
    }
}
