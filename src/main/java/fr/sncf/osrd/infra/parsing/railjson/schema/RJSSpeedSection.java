package fr.sncf.osrd.infra.parsing.railjson.schema;

import com.squareup.moshi.Json;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;

@SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
public class RJSSpeedSection implements Identified {
    public final String id;

    @Json(name = "is_signalized")
    public final boolean isSignalized;

    public final double speed;

    /**
     * Create a RailJSON speed section
     * @param id the unique SpeedSection id
     * @param isSignalized whether the SpeedSection is signalized
     * @param speed the speed limit of the section
     */
    public RJSSpeedSection(String id, boolean isSignalized, double speed) {
        this.id = id;
        this.isSignalized = isSignalized;
        this.speed = speed;
    }

    @Override
    public String getID() {
        return id;
    }
}
