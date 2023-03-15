package fr.sncf.osrd.standalone_sim.result;

import static fr.sncf.osrd.envelope_sim.EnvelopeSimPath.ElectrificationConditions;

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
            RangeMap<Double, ElectrificationConditions> elecCondsUsed,
            RangeMap<Double, ElectrificationConditions> elecCondsSeen) {
        var res = new ArrayList<ResultModeAndProfilePoint>();
        var elecCondsSeenMap = elecCondsSeen.asMapOfRanges();
        for (var entry : elecCondsUsed.asMapOfRanges().entrySet()) {
            if (!entry.getKey().hasLowerBound() || !entry.getKey().hasUpperBound()
                    || entry.getKey().upperEndpoint().equals(entry.getKey().lowerEndpoint()))
                continue;
            assert elecCondsSeenMap.containsKey(entry.getKey())
                    || elecCondsSeen.subRangeMap(entry.getKey()).asMapOfRanges().isEmpty();
            var elecCondUsed = entry.getValue();
            var elecCondSeen = elecCondsSeenMap.get(entry.getKey());
            if (elecCondSeen == null || elecCondSeen.equals(elecCondUsed))
                res.add(new ResultModeAndProfilePoint(entry.getKey().lowerEndpoint(), entry.getKey().upperEndpoint(),
                        elecCondUsed.mode(), elecCondUsed.profile(), null, null));
            else
                res.add(new ResultModeAndProfilePoint(entry.getKey().lowerEndpoint(), entry.getKey().upperEndpoint(),
                        elecCondUsed.mode(), elecCondUsed.profile(), elecCondSeen.mode(), elecCondSeen.profile()));
        }
        return res;
    }
}
