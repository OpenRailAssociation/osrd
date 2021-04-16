package fr.sncf.osrd.railjson.schema.infra;

import com.squareup.moshi.Json;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.trackgraph.SwitchPosition;
import fr.sncf.osrd.railjson.schema.common.Identified;

@SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
public class RJSSwitch implements Identified {
    public final String id;

    /** The base track section of the switch */
    public final RJSTrackSection.EndpointID base;
    /** The track section linked to the base if the switch is in LEFT position */
    public final RJSTrackSection.EndpointID left;
    /** The track section linked to the base if the switch is in RIGHT position */
    public final RJSTrackSection.EndpointID right;
    /** The time it takes for the switch to change position in seconds */
    @Json(name = "position_change_delay")
    public double positionChangeDelay;

    /**
     * Create a new serialized switch
     * @param id the switch ID
     * @param base the base branch
     * @param left the left branch
     * @param right the right branch
     * @param positionChangeDelay the delay when changing position in seconds
     */
    public RJSSwitch(
            String id,
            RJSTrackSection.EndpointID base,
            RJSTrackSection.EndpointID left,
            RJSTrackSection.EndpointID right,
            double positionChangeDelay
    ) {
        this.id = id;
        this.base = base;
        this.left = left;
        this.right = right;
        this.positionChangeDelay = positionChangeDelay;
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
