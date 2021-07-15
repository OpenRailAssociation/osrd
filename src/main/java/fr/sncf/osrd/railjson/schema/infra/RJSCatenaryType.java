package fr.sncf.osrd.railjson.schema.infra;

import com.squareup.moshi.Json;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.railjson.schema.common.Identified;

@SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
public class RJSCatenaryType implements Identified {
    public String id;

    /** type of traction mode */
    public String type;

    /** The voltage of track section for electric mode */
    public double voltage;

    /**
     * Create a RailJSON catenaries
     * @param id the unique catenaries id, that matches the electrical profiles
     * @param type the mode of the rolling stoke
     * @param voltage the voltage of the section
     */
    public RJSCatenaryType(String id, String type, double voltage) {
        this.id = id;
        this.type = type;
        this.voltage = voltage;
    }

    @Override
    public String getID() {
        return id;
    }
}

