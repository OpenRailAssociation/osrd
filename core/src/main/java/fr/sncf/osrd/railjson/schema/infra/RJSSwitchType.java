package fr.sncf.osrd.railjson.schema.infra;

import com.squareup.moshi.Json;
import fr.sncf.osrd.railjson.schema.common.Identified;
import fr.sncf.osrd.railjson.schema.common.RJSObjectRef;
import java.util.List;
import java.util.Map;

public class RJSSwitchType implements Identified {
    public String id;
    public List<String> ports;
    public Map<String, List<SwitchPortConnection>> groups;

    /**
     * Create a new switch type
     * @param ports the names of the ports of the switch
     * @param groups the groups of simultaneously activable edges between ports
     */
    public RJSSwitchType(
            String id,
            List<String> ports,
            Map<String, List<SwitchPortConnection>> groups
    ) {
        this.id = id;
        this.ports = ports;
        this.groups = groups;
    }

    @Override
    public String getID() {
        return id;
    }

    public RJSObjectRef<RJSSwitchType> getRef() {
        return new RJSObjectRef<>(this.id, "SwitchType");
    }

    public static class SwitchPortConnection {
        public String src;
        public String dst;
        public boolean bidirectional;

        /**
         * creates a railjson new port edge (arc between port)
         * @param src the name of the source port
         * @param dst the name of the destination port
         * @param bidirectional true iff the arc is bidirectional
         */
        public SwitchPortConnection(String src, String dst, boolean bidirectional) {
            this.src = src;
            this.dst = dst;
            this.bidirectional = bidirectional;
        }
    }

    public static final RJSSwitchType CLASSIC_TYPE = new RJSSwitchType(
            "classic_switch",
            List.of("base", "left", "right"),
            Map.of(
                "LEFT", List.of(new SwitchPortConnection("base", "left", true)),
                "RIGHT", List.of(new SwitchPortConnection("base", "right", true))
            )
        );
}