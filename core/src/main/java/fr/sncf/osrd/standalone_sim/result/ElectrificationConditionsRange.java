package fr.sncf.osrd.standalone_sim.result;

import static fr.sncf.osrd.envelope_sim.EnvelopeSimPath.ElectrificationConditions;

import com.google.common.collect.RangeMap;
import com.squareup.moshi.Json;
import java.util.ArrayList;
import java.util.List;

/** A range on the train's path with the electrification conditions given by the infrastructure
 * and the conditions actually used by the train.
 *
 * <p>Each `seen_*` variable is filled only when it is different from the `used_*` one.
 *
 * <p>For example: a train handling only "1500" electrification mode is going on a track with mode "25000",
 * and switches to "thermal" mode. Then used_mode = "thermal" and seen_mode = "25000". */
public class ElectrificationConditionsRange {
    public final double start;
    public final double stop;
    @Json(name = "used_mode")
    public final String usedMode;
    @Json(name = "used_profile")
    public final String usedProfile;
    @Json(name = "used_restriction")
    public final String usedRestriction;
    @Json(name = "seen_mode")
    public String seenMode = null;
    @Json(name = "seen_profile")
    public String seenProfile = null;
    @Json(name = "seen_restriction")
    public String seenRestriction = null;

    /**
     * ElectrificationConditionsRange constructor
     */
    public ElectrificationConditionsRange(double start, double stop, ElectrificationConditions usedCond,
                                          ElectrificationConditions seenCond) {
        this.start = start;
        this.stop = stop;
        this.usedMode = usedCond.mode();
        this.usedProfile = usedCond.profile();
        this.usedRestriction = usedCond.powerRestriction();
        if (seenCond != null) {
            if (this.usedMode == null || !this.usedMode.equals(seenCond.mode()))
                this.seenMode = seenCond.mode();
            if (this.usedProfile == null || !this.usedProfile.equals(seenCond.profile()))
                this.seenProfile = seenCond.profile();
            if (this.usedRestriction == null || !this.usedRestriction.equals(seenCond.powerRestriction()))
                this.seenRestriction = seenCond.powerRestriction();
        }
    }

    /**
     * Builds a list of ElectrificationConditionsRanges from two range maps
     */
    public static List<ElectrificationConditionsRange> from(
            RangeMap<Double, ElectrificationConditions> elecCondsUsed,
            RangeMap<Double, ElectrificationConditions> elecCondsSeen) {
        var res = new ArrayList<ElectrificationConditionsRange>();
        var elecCondsSeenMap = elecCondsSeen.asMapOfRanges();
        for (var entry : elecCondsUsed.asMapOfRanges().entrySet()) {
            var range = entry.getKey();
            if (!range.hasLowerBound() || !range.hasUpperBound() || range.upperEndpoint().equals(range.lowerEndpoint()))
                continue;
            assert elecCondsSeenMap.containsKey(range) || elecCondsSeen.subRangeMap(range).asMapOfRanges().isEmpty();
            var usedCond = entry.getValue();
            var seenCond = elecCondsSeenMap.get(range);
            res.add(new ElectrificationConditionsRange(range.lowerEndpoint(), range.upperEndpoint(), usedCond,
                    seenCond));
        }
        return res;
    }
}
