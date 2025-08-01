package fr.sncf.osrd.standalone_sim.result;

import com.google.common.base.MoreObjects;
import com.google.common.collect.RangeMap;
import com.squareup.moshi.Json;
import com.squareup.moshi.adapters.PolymorphicJsonAdapterFactory;
import fr.sncf.osrd.path.interfaces.Electrification;
import fr.sncf.osrd.path.legacy_objects.electrification.Electrified;
import fr.sncf.osrd.path.legacy_objects.electrification.Neutral;
import fr.sncf.osrd.path.legacy_objects.electrification.NonElectrified;
import fr.sncf.osrd.train.RollingStock;
import fr.sncf.osrd.utils.jacoco.ExcludeFromGeneratedCodeCoverage;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

/**
 * A range on the train's path with the electrificationUsage conditions given by the infrastructure
 * if electrified, details about the mode and electrical profiles are given.
 */
public class ElectrificationRange {
    public final double start;
    public double stop;

    public final ElectrificationUsage electrificationUsage;

    public static final PolymorphicJsonAdapterFactory<ElectrificationUsage> adapter = (PolymorphicJsonAdapterFactory.of(
                    ElectrificationUsage.class, "object_type")
            .withSubtype(ElectrificationUsage.ElectrifiedUsage.class, "Electrified")
            .withSubtype(ElectrificationUsage.NeutralUsage.class, "Neutral")
            .withSubtype(ElectrificationUsage.NonElectrifiedUsage.class, "NonElectrified"));

    public static class ElectrificationUsage {
        public static class ElectrifiedUsage extends ElectrificationUsage {
            public final String mode;

            @Json(name = "mode_handled")
            public final boolean modeHandled;

            public final String profile;

            @Json(name = "profile_handled")
            public final boolean profileHandled;

            public ElectrifiedUsage(String mode, boolean modeHandled, String profile, boolean profileHandled) {
                this.mode = mode;
                this.modeHandled = modeHandled;
                this.profile = profile;
                this.profileHandled = profileHandled;
            }

            /** Returns true if the two electrification usages share the same values */
            public boolean equals(Object other) {
                if (!(other instanceof ElectrifiedUsage o)) return false;
                return Objects.equals(this.mode, o.mode)
                        && this.modeHandled == o.modeHandled
                        && Objects.equals(this.profile, o.profile)
                        && this.profileHandled == o.profileHandled;
            }

            public int hashCode() {
                return Objects.hash(mode, modeHandled, profile, profileHandled);
            }

            @Override
            @ExcludeFromGeneratedCodeCoverage
            public String toString() {
                return MoreObjects.toStringHelper(this)
                        .add("mode", mode)
                        .add("modeHandled", modeHandled)
                        .add("profile", profile)
                        .add("profileHandled", profileHandled)
                        .toString();
            }
        }

        public static class NeutralUsage extends ElectrificationUsage {
            @Json(name = "lower_pantograph")
            public final boolean lowerPantograph;

            public NeutralUsage(boolean isLowerPantograph) {
                this.lowerPantograph = isLowerPantograph;
            }

            public boolean equals(Object other) {
                if (!(other instanceof NeutralUsage o)) return false;
                return this.lowerPantograph == o.lowerPantograph;
            }

            public int hashCode() {
                return Objects.hash(lowerPantograph);
            }

            @Override
            @ExcludeFromGeneratedCodeCoverage
            public String toString() {
                return MoreObjects.toStringHelper(this)
                        .add("isLowerPantograph", lowerPantograph)
                        .toString();
            }
        }

        public static class NonElectrifiedUsage extends ElectrificationUsage {
            public boolean equals(Object other) {
                return other instanceof NonElectrifiedUsage;
            }

            public int hashCode() {
                return 0;
            }
        }

        private static ElectrificationUsage from(RollingStock.InfraConditions usedCond, Electrification seenCond) {
            if (seenCond instanceof NonElectrified) return new NonElectrifiedUsage();
            if (seenCond instanceof Electrified e) {
                return new ElectrifiedUsage(
                        e.mode,
                        Objects.equals(usedCond.mode(), e.mode),
                        e.profile,
                        Objects.equals(usedCond.electricalProfile(), e.profile));
            }
            if (seenCond instanceof Neutral n) {
                if (n.isAnnouncement) {
                    return null;
                } else {
                    return new NeutralUsage(n.lowerPantograph);
                }
            }
            throw new RuntimeException("Unknown electrification type");
        }
    }

    /** ElectrificationRange constructor */
    public ElectrificationRange(
            double start, double stop, RollingStock.InfraConditions usedCond, Electrification seenCond) {
        this.start = start;
        this.stop = stop;
        this.electrificationUsage = ElectrificationUsage.from(usedCond, seenCond);
    }

    /** Returns true if the two ranges share the same values */
    public boolean shouldBeMergedWith(ElectrificationRange other) {
        var valueMerge = this.electrificationUsage != null // if null, don't merge
                && (this.electrificationUsage.equals(other.electrificationUsage)
                        || other.electrificationUsage == null); // if not null and other is equal or null, merge
        var rangeMerge = (this.stop <= other.start);
        return valueMerge && rangeMerge;
    }

    /**
     * Builds a list of ElectrificationRanges from two range maps while ensuring to return the
     * smallest number of ranges
     */
    public static List<ElectrificationRange> from(
            RangeMap<Double, RollingStock.InfraConditions> condsUsed, RangeMap<Double, Electrification> condsSeen) {
        var res = new ArrayList<ElectrificationRange>();
        var elecCondsSeenMap = condsSeen.asMapOfRanges();
        for (var entry : condsUsed.asMapOfRanges().entrySet()) {
            var range = entry.getKey();
            if (!range.hasLowerBound()
                    || !range.hasUpperBound()
                    || range.upperEndpoint().equals(range.lowerEndpoint())) continue;
            assert elecCondsSeenMap.containsKey(range)
                    || condsSeen.subRangeMap(range).asMapOfRanges().isEmpty();
            var usedCond = entry.getValue();
            var seenCond = elecCondsSeenMap.get(range);
            var newRange = new ElectrificationRange(range.lowerEndpoint(), range.upperEndpoint(), usedCond, seenCond);
            if (res.isEmpty() || !res.get(res.size() - 1).shouldBeMergedWith(newRange)) res.add(newRange);
            else res.get(res.size() - 1).stop = newRange.stop;
        }
        return res;
    }
}
