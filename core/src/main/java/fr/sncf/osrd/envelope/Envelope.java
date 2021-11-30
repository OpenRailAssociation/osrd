package fr.sncf.osrd.envelope;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;

@SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
public final class Envelope  {
    private final EnvelopePart[] parts;
    public final boolean spaceContinuous;
    public final boolean continuous;
    public final boolean physicallyAccurate;

    public int size() {
        return parts.length;
    }

    public EnvelopePart get(int i) {
        return parts[i];
    }

    private Envelope(EnvelopePart[] parts, boolean spaceContinuous, boolean continuous, boolean physicallyAccurate) {
        this.parts = parts;
        this.spaceContinuous = spaceContinuous;
        this.continuous = continuous;
        this.physicallyAccurate = physicallyAccurate;
    }

    /** Create a new Envelope */
    public static Envelope make(EnvelopePart... parts) {
        boolean spaceContinuous = arePartsSpaceContinuous(parts);
        boolean continuous = spaceContinuous && arePartsSpeedContinuous(parts);
        boolean physicallyAccurate = continuous && arePartsPhysicallyAccurate(parts);
        return new Envelope(parts, spaceContinuous, continuous, physicallyAccurate);
    }

    private static boolean arePartsSpaceContinuous(EnvelopePart[] parts) {
        for (int i = 0; i < parts.length - 1; i++)
            if (parts[i].getEndPos() != parts[i + 1].getBeginPos())
                return false;
        return true;
    }

    private static boolean arePartsSpeedContinuous(EnvelopePart[] parts) {
        for (int i = 0; i < parts.length - 1; i++)
            if (parts[i].getEndSpeed() != parts[i + 1].getBeginSpeed())
                return false;
        return true;
    }

    private static boolean arePartsPhysicallyAccurate(EnvelopePart[] parts) {
        for (var part : parts)
            if (!part.physicallyAccurate)
                return false;
        return true;
    }
}