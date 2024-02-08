package fr.sncf.osrd.standalone_sim.result;

import com.google.common.base.MoreObjects;
import com.squareup.moshi.Json;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.utils.jacoco.ExcludeFromGeneratedCodeCoverage;

@SuppressFBWarnings("URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD")
public class SignalUpdate {

    /** ID of the updated signal */
    @Json(name = "signal_id")
    public final String signalID;

    /** Time of the update */
    @Json(name = "time_start")
    public final double timeStart;

    /** Time at which the signal changes to a different state */
    @Json(name = "time_end")
    public final Double timeEnd;

    /** Position of the signal */
    @Json(name = "position_start")
    public final double positionStart;

    /** Position of the end of the signal "semiblock" */
    @Json(name = "position_end")
    public final Double positionEnd;

    /** Color to be displayed for the given state, as encoded by {@link java.awt.Color#getRGB}. */
    public final int color;

    /** True if the signal is blinking */
    public final boolean blinking;

    /** Name of this signal aspect */
    @Json(name = "aspect_label")
    public final String aspectLabel;

    public final String track;

    @Json(name = "track_offset")
    public final Double trackOffset;

    /** Constructor */
    public SignalUpdate(
            String signalID,
            double timeStart,
            Double timeEnd,
            double positionStart,
            Double positionEnd,
            int color,
            boolean blinking,
            String aspectLabel,
            String track,
            Double trackOffset) {
        this.signalID = signalID;
        this.timeStart = timeStart;
        this.timeEnd = timeEnd;
        this.positionStart = positionStart;
        this.positionEnd = positionEnd;
        this.color = color;
        this.blinking = blinking;
        this.aspectLabel = aspectLabel;
        this.track = track;
        this.trackOffset = trackOffset;
    }

    @Override
    @ExcludeFromGeneratedCodeCoverage
    public String toString() {
        return MoreObjects.toStringHelper(this)
                .add("signalID", signalID)
                .add("timeStart", timeStart)
                .add("timeEnd", timeEnd)
                .add("positionStart", positionStart)
                .add("positionEnd", positionEnd)
                .add("color", color)
                .add("blinking", blinking)
                .toString();
    }
}
