package fr.sncf.osrd.infra;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.trackgraph.Detector;
import fr.sncf.osrd.utils.graph.EdgeDirection;

@SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
public final class Signal {
    public final int index;
    public final double sightDistance;
    public final String id;
    public final EdgeDirection direction;

    /** If it exists, the detector linked to the signal, else null */
    public final Detector linkedDetector;

    /** The static data describing a signal */
    public Signal(
            int index,
            String id,
            EdgeDirection direction,
            double sightDistance,
            Detector linkedDetector
    ) {
        this.index = index;
        this.id = id;
        this.direction = direction;
        this.sightDistance = sightDistance;
        this.linkedDetector = linkedDetector;
    }

    @Override
    public String toString() {
        return String.format("Signal { id=%s }", id);
    }
}
