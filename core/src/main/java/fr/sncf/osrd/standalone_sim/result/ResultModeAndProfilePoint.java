package fr.sncf.osrd.standalone_sim.result;

import static fr.sncf.osrd.envelope_sim.EnvelopeSimPath.ModeAndProfile;

import com.google.common.collect.RangeMap;
import com.squareup.moshi.Json;
import java.util.ArrayList;
import java.util.List;

public class ResultModeAndProfilePoint {
    public final double start;
    public final double stop;
    @Json(name = "used_mode")
    public final String usedMode;
    @Json(name = "used_profile")
    public final String usedProfile;
    @Json(name = "seen_mode")
    public final String seenMode;
    @Json(name = "seen_profile")
    public final String seenProfile;

    /**
     * ResultModeAndProfilePoint constructor
     */
    public ResultModeAndProfilePoint(double start, double stop, String usedMode, String usedProfile, String seenMode,
                                     String seenProfile) {
        this.start = start;
        this.stop = stop;
        this.usedMode = usedMode;
        this.usedProfile = usedProfile;
        this.seenMode = seenMode;
        this.seenProfile = seenProfile;
    }

    /**
     * Builds a list of ResultModeAndProfilePoint from two range maps
     */
    public static List<ResultModeAndProfilePoint> from(
            RangeMap<Double, ModeAndProfile> modesAndProfilesUsed,
            RangeMap<Double, ModeAndProfile> modesAndProfilesSeen) {
        var res = new ArrayList<ResultModeAndProfilePoint>();
        var modesAndProfilesSeenMap = modesAndProfilesSeen.asMapOfRanges();
        for (var entry : modesAndProfilesUsed.asMapOfRanges().entrySet()) {
            if (!entry.getKey().hasLowerBound() || !entry.getKey().hasUpperBound()
                    || entry.getKey().upperEndpoint().equals(entry.getKey().lowerEndpoint()))
                continue;
            assert modesAndProfilesSeenMap.containsKey(entry.getKey())
                    || modesAndProfilesSeen.subRangeMap(entry.getKey()).asMapOfRanges().isEmpty();
            var modeAndProfileUsed = entry.getValue();
            var modeAndProfileSeen = modesAndProfilesSeenMap.get(entry.getKey());
            if (modeAndProfileSeen == null || modeAndProfileSeen.equals(modeAndProfileUsed))
                res.add(new ResultModeAndProfilePoint(entry.getKey().lowerEndpoint(), entry.getKey().upperEndpoint(),
                        modeAndProfileUsed.mode(), modeAndProfileUsed.profile(), null, null));
            else
                res.add(new ResultModeAndProfilePoint(entry.getKey().lowerEndpoint(), entry.getKey().upperEndpoint(),
                        modeAndProfileUsed.mode(), modeAndProfileUsed.profile(), modeAndProfileSeen.mode(),
                        modeAndProfileSeen.profile()));
        }
        return res;
    }
}
