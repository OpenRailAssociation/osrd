package fr.sncf.osrd.infra;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;

@SuppressFBWarnings(
        value = "URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD",
        justification = "kept for later use"
)
public class Track {
    public final String name;
    public final String id;
    public final Line line;

    /**
     * Creates a new track.
     * @param name The display name for this track
     * @param id The unique identifier for this track
     */
    public Track(String name, String id, Line line)  {
        this.name = name;
        this.id = id;
        this.line = line;
    }
}
