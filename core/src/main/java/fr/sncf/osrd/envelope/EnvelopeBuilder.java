package fr.sncf.osrd.envelope;

import java.util.ArrayList;

public final class EnvelopeBuilder {
    private ArrayList<EnvelopePart> parts = new ArrayList<>();

    /** Adds a part to the envelope */
    public void addPart(EnvelopePart part) {
        assert parts != null : "build() was already called";
        parts.add(part);
    }

    /** Reverses the order of the parts */
    public void reverse() {
        assert parts != null : "build() was already called";
        for (int i = 0; i < parts.size() / 2; i++) {
            var tmp = parts.get(i);
            parts.set(i, parts.get(parts.size() - i - 1));
            parts.set(parts.size() - i - 1, tmp);
        }
    }

    /** Creates a new Envelope */
    public Envelope build() {
        assert parts != null : "build() was already called";
        var envelope =  Envelope.make(parts.toArray(new EnvelopePart[0]));
        parts = null;
        return envelope;
    }
}
