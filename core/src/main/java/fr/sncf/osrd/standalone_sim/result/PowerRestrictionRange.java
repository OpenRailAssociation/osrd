package fr.sncf.osrd.standalone_sim.result;

import com.google.common.collect.RangeMap;
import fr.sncf.osrd.train.RollingStock;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

public class PowerRestrictionRange {
    public final double start;
    public double stop;
    public final String code;
    public final boolean handled;

    public PowerRestrictionRange(double start, double stop, RollingStock.InfraConditions usedCond,
                                 String seenCode) {
        this.start = start;
        this.stop = stop;
        this.code = seenCode;
        this.handled = Objects.equals(seenCode, usedCond.powerRestriction());
    }

    public boolean shouldBeMergedWith(PowerRestrictionRange other) {
        return Objects.equals(this.code, other.code) && this.handled == other.handled && this.stop <= other.start;
    }

    /**
     * Builds a list of PowerRestrictionRange from two range maps while ensuring
     * to return the smallest number of ranges
     */
    public static List<PowerRestrictionRange> from(
            RangeMap<Double, RollingStock.InfraConditions> condsUsed,
            RangeMap<Double, String> powerRestrictionMap) {
        var res = new ArrayList<PowerRestrictionRange>();
        for (var entry : condsUsed.asMapOfRanges().entrySet()) {
            var range = entry.getKey();
            if (!range.hasLowerBound() || !range.hasUpperBound() || range.upperEndpoint().equals(range.lowerEndpoint()))
                continue;
            var subPowerRestrictionMap = powerRestrictionMap.subRangeMap(range).asMapOfRanges();
            if (subPowerRestrictionMap.isEmpty())
                continue;
            assert subPowerRestrictionMap.size() == 1;
            var usedCond = entry.getValue();
            var seenCond = subPowerRestrictionMap.values().iterator().next();
            var newRange = new PowerRestrictionRange(range.lowerEndpoint(), range.upperEndpoint(), usedCond,
                    seenCond);
            if (res.isEmpty() || !res.get(res.size() - 1).shouldBeMergedWith(newRange))
                res.add(newRange);
            else
                res.get(res.size() - 1).stop = newRange.stop;
        }
        return res;
    }
}
