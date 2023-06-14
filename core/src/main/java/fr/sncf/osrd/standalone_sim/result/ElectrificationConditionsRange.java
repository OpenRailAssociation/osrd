package fr.sncf.osrd.standalone_sim.result;

import com.google.common.collect.RangeMap;
import com.squareup.moshi.Json;
import fr.sncf.osrd.envelope_sim.electrification.Electrification;
import fr.sncf.osrd.envelope_sim.electrification.Electrified;
import fr.sncf.osrd.train.RollingStock;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

/** A range on the train's path with the electrification conditions given by the infrastructure
 * and the conditions actually used by the train.
 *
 * <p>Each `seen_*` variable is filled only when it is different from the `used_*` one.
 *
 * <p>For example: a train handling only "1500" electrification mode is going on a track with mode "25000",
 * and switches to "thermal" mode. Then used_mode = "thermal" and seen_mode = "25000". */
public class ElectrificationConditionsRange {
    public final double start;
    public double stop;
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
    public ElectrificationConditionsRange(double start, double stop, RollingStock.InfraConditions usedCond,
                                          Electrification seenCond) {
        this.start = start;
        this.stop = stop;
        this.usedMode = usedCond.mode();
        this.usedProfile = usedCond.electricalProfile();
        this.usedRestriction = usedCond.powerRestriction();

        if (seenCond instanceof Electrified e) {
            if (this.usedMode == null || !this.usedMode.equals(e.mode))
                this.seenMode = e.mode;
            if (this.usedProfile == null || !this.usedProfile.equals(e.profile))
                this.seenProfile = e.profile;
            if (this.usedRestriction == null || !this.usedRestriction.equals(e.powerRestriction))
                this.seenRestriction = e.powerRestriction;
        }
    }

    /**
     * Returns true if the two ranges share the same values
     */
    public boolean sharesValueWith(ElectrificationConditionsRange other) {
        return Objects.equals(this.usedMode, other.usedMode)
                && Objects.equals(this.usedProfile, other.usedProfile)
                && Objects.equals(this.usedRestriction, other.usedRestriction)
                && Objects.equals(this.seenMode, other.seenMode)
                && Objects.equals(this.seenProfile, other.seenProfile)
                && Objects.equals(this.seenRestriction, other.seenRestriction);
    }

    /**
     * Builds a list of ElectrificationConditionsRanges from two range maps while ensuring
     * to return the smallest number of ranges
     */
    public static List<ElectrificationConditionsRange> from(
            RangeMap<Double, RollingStock.InfraConditions> condsUsed,
            RangeMap<Double, Electrification> condsSeen) {
        var res = new ArrayList<ElectrificationConditionsRange>();
        var elecCondsSeenMap = condsSeen.asMapOfRanges();
        for (var entry : condsUsed.asMapOfRanges().entrySet()) {
            var range = entry.getKey();
            if (!range.hasLowerBound() || !range.hasUpperBound() || range.upperEndpoint().equals(range.lowerEndpoint()))
                continue;
            assert elecCondsSeenMap.containsKey(range) || condsSeen.subRangeMap(range).asMapOfRanges().isEmpty();
            var usedCond = entry.getValue();
            var seenCond = elecCondsSeenMap.get(range);
            var newRange = new ElectrificationConditionsRange(range.lowerEndpoint(), range.upperEndpoint(), usedCond,
                    seenCond);
            if (res.isEmpty() || !res.get(res.size() - 1).sharesValueWith(newRange))
                res.add(newRange);
            else
                res.get(res.size() - 1).stop = newRange.stop;
        }
        return res;
    }
}
