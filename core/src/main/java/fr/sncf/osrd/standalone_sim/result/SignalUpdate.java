package fr.sncf.osrd.standalone_sim.result;

import com.google.common.base.MoreObjects;
import com.squareup.moshi.Json;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.api.signaling.SignalState;
import fr.sncf.osrd.utils.jacoco.ExcludeFromGeneratedCodeCoverage;
import java.util.Set;

@SuppressFBWarnings("URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD")
public class SignalUpdate {

    /** ID of the updated signal */
    @Json(name = "signal_id")
    public final String signalID;

    /** IDs of all the routes protected by the updated signal */
    @Json(name = "route_ids")
    public final Set<String> routeIDs;

    /** Time of the update */
    @Json(name = "time_start")
    public final double timeStart;

    /** Time at which the signal changes to a different state */
    @Json(name = "time_end")
    public final double timeEnd;

    /** Color to be displayed for the given state, as encoded by {@link java.awt.Color#getRGB}. */
    public final int color;

    /** True if the signal is blinking */
    public final boolean blinking;

    /** Constructor */
    public SignalUpdate(
            String signalID,
            Set<String> routeIDs,
            double timeStart,
            double timeEnd,
            int color,
            boolean blinking
    ) {
        this.signalID = signalID;
        this.routeIDs = routeIDs;
        this.timeStart = timeStart;
        this.timeEnd = timeEnd;
        this.color = color;
        this.blinking = blinking;
    }

    @Override
    @ExcludeFromGeneratedCodeCoverage
    public String toString() {
        return MoreObjects.toStringHelper(this)
                .add("signalID", signalID)
                .add("routeIDs", routeIDs)
                .add("timeStart", timeStart)
                .add("timeEnd", timeEnd)
                .add("color", color)
                .add("blinking", blinking)
                .toString();
    }
}
