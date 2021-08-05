package fr.sncf.osrd.railjson.schema.infra;

import com.squareup.moshi.Json;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import java.util.List;
import java.util.Map;

public class RJSSwitchType {

    @Json(name = "ports")
    @SuppressFBWarnings(value = {"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"}, justification = "useful for parsing check")
    public List<String> ports;

    @Json(name = "groups")
    public Map<String, List<PortEdge>> groups;

    /**
     * Create a new switch type
     * @param ports the names of the ports of the switch
     * @param groups the groups of simultaneously activable edges between ports
     */
    public RJSSwitchType(
            List<String> ports,
            Map<String, List<PortEdge>> groups
    ) {
        this.ports = ports;
        this.groups = groups;
    }

    public static class PortEdge {

        @Json(name = "src")
        public String src;

        @Json(name = "dst")
        public String dst;

        @Json(name = "bidirectional")
        public boolean bidirectional;

        /**
         * creates a railjson new port edge (arc between port)
         * @param src the name of the source port
         * @param dst the name of the destination port
         * @param bidirectional true iff the arc is bidirectional
         */
        public PortEdge(String src, String dst, boolean bidirectional) {
            this.src = src;
            this.dst = dst;
            this.bidirectional = bidirectional;
        }
    }

    public static final String CLASSIC_NAME = "CLASSIC_SWITCH";

    public static final RJSSwitchType CLASSIC_TYPE = new RJSSwitchType(
            List.of("base", "left", "right"),
            Map.of(
                "LEFT", List.of(new PortEdge("base", "left", true)),
                "RIGHT", List.of(new PortEdge("base", "right", true))
            )
        );

    /**
     * helper to create a classic switch
     * @param id the id of the switch
     * @param base the base track section endpoint
     * @param left the left track section endpoint
     * @param right the right track section endpoint
     * @param positionChangeDelay the position change delay
     * @return a new corresponding RJSSwitch
     */
    public static RJSSwitch makeClassic(
            String id,
            RJSTrackSection.EndpointID base,
            RJSTrackSection.EndpointID left,
            RJSTrackSection.EndpointID right,
            double positionChangeDelay) {
        return new RJSSwitch(
            id,
            CLASSIC_NAME,
            Map.of("base", base, "left", left, "right", right),
            positionChangeDelay
        );
    }
}