package fr.sncf.osrd.railjson.schema.infra;

import com.squareup.moshi.Json;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.railjson.schema.common.Identified;
import fr.sncf.osrd.railjson.schema.common.RJSObjectRef;
import java.util.Map;

@SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
public class RJSSwitch implements Identified {
    public String id;

    /** The type of the switch */
    @Json(name = "switch_type")
    public RJSObjectRef<RJSSwitchType> switchType;

    /** The track sections connected to the ports of the switch */
    public Map<String, RJSTrackEndpoint> ports;

    @Json(name = "group_change_delay")
    public double groupChangeDelay;

    /**
     * Create a new serialized switch
     * @param id the switch ID
     * @param switchType the type of the switch
     * @param ports the track sections connected to the ports
     * @param groupChangeDelay the delay when changing the position in seconds
     */
    public RJSSwitch(
            String id,
            RJSObjectRef<RJSSwitchType> switchType,
            Map<String, RJSTrackEndpoint> ports,
            double groupChangeDelay
    ) {
        this.id = id;
        this.switchType = switchType;
        this.ports = ports;
        this.groupChangeDelay = groupChangeDelay;
    }

    @Override
    public String getID() {
        return id;
    }
}
