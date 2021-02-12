package fr.sncf.osrd.infra.parsing.railjson.schema;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;

@SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
public class Switch implements Identified {
    public final String id;

    public final TrackSection.EndpointID base;
    public final TrackSection.EndpointID left;
    public final TrackSection.EndpointID right;

    /**
     * Create a new serialized switch
     * @param id the switch ID
     * @param base the base branch
     * @param left the left branch
     * @param right the right branch
     */
    public Switch(
            String id,
            TrackSection.EndpointID base,
            TrackSection.EndpointID left,
            TrackSection.EndpointID right
    ) {
        this.id = id;
        this.base = base;
        this.left = left;
        this.right = right;
    }

    @Override
    public String getID() {
        return id;
    }
}
