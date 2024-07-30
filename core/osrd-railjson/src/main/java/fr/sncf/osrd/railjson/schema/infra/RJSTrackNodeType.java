package fr.sncf.osrd.railjson.schema.infra;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.railjson.schema.common.Identified;
import java.util.List;
import java.util.Map;

public class RJSTrackNodeType implements Identified {
    public String id;
    public List<String> ports;
    public Map<String, List<TrackNodePortConnection>> groups;

    /**
     * Create a new switch type
     *
     * @param ports the names of the ports of the switch
     * @param groups the groups of simultaneously activable edges between ports
     */
    public RJSTrackNodeType(String id, List<String> ports, Map<String, List<TrackNodePortConnection>> groups) {
        this.id = id;
        this.ports = ports;
        this.groups = groups;
    }

    @Override
    public String getID() {
        return id;
    }

    @SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
    public static class TrackNodePortConnection {
        public String src;
        public String dst;

        /**
         * creates a railjson new port edge (arc between port)
         *
         * @param src the name of the source port
         * @param dst the name of the destination port
         */
        public TrackNodePortConnection(String src, String dst) {
            this.src = src;
            this.dst = dst;
        }
    }

    public static final RJSTrackNodeType CLASSIC_TYPE = new RJSTrackNodeType(
            "point_switch",
            List.of("A", "B1", "B2"),
            Map.of(
                    "A_B1", List.of(new TrackNodePortConnection("A", "B1")),
                    "A_B2", List.of(new TrackNodePortConnection("A", "B2"))));

    public static final RJSTrackNodeType LINK =
            new RJSTrackNodeType("link", List.of("A", "B"), Map.of("STATIC", List.of(new TrackNodePortConnection("A", "B"))));

    public static final RJSTrackNodeType CROSSING = new RJSTrackNodeType(
            "crossing",
            List.of("A1", "B1", "A2", "B2"),
            Map.of("STATIC", List.of(new TrackNodePortConnection("A1", "B1"), new TrackNodePortConnection("A2", "B2"))));
    public static final RJSTrackNodeType SINGLE_SLIP_SWITCH = new RJSTrackNodeType(
            "single_slip_switch",
            List.of("A1", "B1", "A2", "B2"),
            Map.of(
                    "STATIC",
                    List.of(new TrackNodePortConnection("A1", "B1"), new TrackNodePortConnection("A2", "B2")),
                    "A1_B2",
                    List.of(new TrackNodePortConnection("A1", "B2"))));

    public static final RJSTrackNodeType DOUBLE_SLIP_SWITCH = new RJSTrackNodeType(
            "double_slip_switch",
            List.of("A1", "B1", "A2", "B2"),
            Map.of(
                    "A1_B1",
                    List.of(new TrackNodePortConnection("A1", "B1")),
                    "A1_B2",
                    List.of(new TrackNodePortConnection("A1", "B2")),
                    "A2_B1",
                    List.of(new TrackNodePortConnection("A2", "B1")),
                    "A2_B2",
                    List.of(new TrackNodePortConnection("A2", "B2"))));

    public static final List<RJSTrackNodeType> BUILTIN_NODE_TYPES_LIST =
            List.of(CLASSIC_TYPE, LINK, CROSSING, SINGLE_SLIP_SWITCH, DOUBLE_SLIP_SWITCH);
}
