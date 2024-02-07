package fr.sncf.osrd.railjson.schema.infra;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.railjson.schema.common.Identified;
import java.util.List;
import java.util.Map;

public class RJSSwitchType implements Identified {
    public String id;
    public List<String> ports;
    public Map<String, List<SwitchPortConnection>> groups;

    /**
     * Create a new switch type
     *
     * @param ports the names of the ports of the switch
     * @param groups the groups of simultaneously activable edges between ports
     */
    public RJSSwitchType(String id, List<String> ports, Map<String, List<SwitchPortConnection>> groups) {
        this.id = id;
        this.ports = ports;
        this.groups = groups;
    }

    @Override
    public String getID() {
        return id;
    }

    @SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
    public static class SwitchPortConnection {
        public String src;
        public String dst;

        /**
         * creates a railjson new port edge (arc between port)
         *
         * @param src the name of the source port
         * @param dst the name of the destination port
         */
        public SwitchPortConnection(String src, String dst) {
            this.src = src;
            this.dst = dst;
        }
    }

    public static final RJSSwitchType CLASSIC_TYPE = new RJSSwitchType(
            "point_switch",
            List.of("A", "B1", "B2"),
            Map.of(
                    "A_B1", List.of(new SwitchPortConnection("A", "B1")),
                    "A_B2", List.of(new SwitchPortConnection("A", "B2"))));

    public static final RJSSwitchType LINK =
            new RJSSwitchType("link", List.of("A", "B"), Map.of("STATIC", List.of(new SwitchPortConnection("A", "B"))));

    public static final RJSSwitchType CROSSING = new RJSSwitchType(
            "crossing",
            List.of("A1", "B1", "A2", "B2"),
            Map.of("STATIC", List.of(new SwitchPortConnection("A1", "B1"), new SwitchPortConnection("A2", "B2"))));
    public static final RJSSwitchType SINGLE_SLIP_SWITCH = new RJSSwitchType(
            "single_slip_switch",
            List.of("A1", "B1", "A2", "B2"),
            Map.of(
                    "STATIC",
                    List.of(new SwitchPortConnection("A1", "B1"), new SwitchPortConnection("A2", "B2")),
                    "A1_B2",
                    List.of(new SwitchPortConnection("A1", "B2"))));

    public static final RJSSwitchType DOUBLE_SLIP_SWITCH = new RJSSwitchType(
            "double_slip_switch",
            List.of("A1", "B1", "A2", "B2"),
            Map.of(
                    "A1_B1",
                    List.of(new SwitchPortConnection("A1", "B1")),
                    "A1_B2",
                    List.of(new SwitchPortConnection("A1", "B2")),
                    "A2_B1",
                    List.of(new SwitchPortConnection("A2", "B1")),
                    "A2_B2",
                    List.of(new SwitchPortConnection("A2", "B2"))));

    public static final List<RJSSwitchType> BUILTIN_NODE_TYPES_LIST =
            List.of(CLASSIC_TYPE, LINK, CROSSING, SINGLE_SLIP_SWITCH, DOUBLE_SLIP_SWITCH);
}
