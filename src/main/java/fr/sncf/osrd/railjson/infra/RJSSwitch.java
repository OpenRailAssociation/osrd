package fr.sncf.osrd.railjson.infra;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.trackgraph.SwitchPosition;

@SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
public class RJSSwitch implements Identified {
    public final String id;

    /** The base track section of the switch */
    public final RJSTrackSection.EndpointID base;
    /** The track section linked to the base if the switch is in LEFT position */
    public final RJSTrackSection.EndpointID left;
    /** The track section linked to the base if the switch is in RIGHT position */
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
        LEFT, RIGHT;

        /** Parse into SwitchPosition */
        public SwitchPosition parse() {
            switch (this) {
                case LEFT:
                    return SwitchPosition.LEFT;
                case RIGHT:
                    return SwitchPosition.RIGHT;
            }
            return null;
        }
    }
}
