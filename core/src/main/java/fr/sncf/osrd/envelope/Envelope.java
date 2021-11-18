package fr.sncf.osrd.envelope;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import java.util.ArrayList;

@SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
public final class Envelope {
    public ArrayList<EnvelopePart> parts;

    public Envelope(ArrayList<EnvelopePart> parts) {
        this.parts = parts;
    }
}
