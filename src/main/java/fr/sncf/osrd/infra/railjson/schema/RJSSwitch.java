package fr.sncf.osrd.infra.railjson.schema;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;

@SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
public class RJSSwitch implements Identified {
    public final String id;

    public final RJSTrackSection.EndpointID base;
    public final RJSTrackSection.EndpointID left;
    public final RJSTrackSection.EndpointID right;

    /**
     * Create a new serialized switch
     * @param id the switch ID
     * @param base the base branch
     * @param left the left branch
     * @param right the right branch
     */
    public RJSSwitch(
            String id,
            RJSTrackSection.EndpointID base,
            RJSTrackSection.EndpointID left,
            RJSTrackSection.EndpointID right
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

    public enum Position {
        LEFT, RIGHT
    }
}
