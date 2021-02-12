package fr.sncf.osrd.infra.parsing.railjson.schema.trackobjects;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.parsing.railjson.schema.Navigability;

@SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
public class BufferStop extends DirectionalTrackObject {
    public final String id;

    BufferStop(String id, Navigability navigability, double position) {
        super(navigability, position);
        this.id = id;
    }
}
