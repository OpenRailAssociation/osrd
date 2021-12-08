package fr.sncf.osrd.railjson.schema.infra;

import com.squareup.moshi.Json;
import fr.sncf.osrd.railjson.schema.common.Identified;
import fr.sncf.osrd.railjson.schema.common.ObjectRef;
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

    public static class SwitchPortConnection {

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
        public SwitchPortConnection(String src, String dst, boolean bidirectional) {
            this.src = src;
            this.dst = dst;
            this.bidirectional = bidirectional;
        }
    }

    public static final String CLASSIC_NAME = "CLASSIC_SWITCH";

    public static final ObjectRef<RJSSwitchType> CLASSIC_REF = new ObjectRef<>("CLASSIC_SWITCH", "switch_type");

    public static final RJSSwitchType CLASSIC_TYPE = new RJSSwitchType(
            CLASSIC_NAME,
            List.of("base", "left", "right"),
            Map.of(
                "LEFT", List.of(new SwitchPortConnection("base", "left", true)),
                "RIGHT", List.of(new SwitchPortConnection("base", "right", true))
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
            RJSTrackEndpoint base,
            RJSTrackEndpoint left,
            RJSTrackEndpoint right,
            double positionChangeDelay) {
        return new RJSSwitch(
            id,
            new ObjectRef<>(CLASSIC_NAME, "switch_type"),
            Map.of("base", base, "left", left, "right", right),
            positionChangeDelay
        );
    }
}