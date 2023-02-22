package fr.sncf.osrd.envelope;

import fr.sncf.osrd.envelope.part.EnvelopePart;
import java.util.ArrayList;

/** Creates an envelope by concatenating envelope parts. Envelope parts must not overlap. */
public final class EnvelopeBuilder {
    private ArrayList<EnvelopePart> parts = new ArrayList<>();

    /** Concatenates multiple envelopes together */
    public static Envelope concatenate(Envelope... envelopes) {
        var res = new EnvelopeBuilder();
        for (var envelope : envelopes)
            res.addEnvelope(envelope);
        return res.build();
    }

    /** Adds a part to the envelope */
    public void addPart(EnvelopePart part) {
        assert parts != null : "build() was already called";
        parts.add(part);
    }

    /** Adds a list of parts */
    public void addParts(EnvelopePart[] parts) {
        for (var part : parts)
            addPart(part);
    }

    /** Adds all parts of an envelope */
    public void addEnvelope(Envelope envelope) {
        for (var part : envelope)
            addPart(part);
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
