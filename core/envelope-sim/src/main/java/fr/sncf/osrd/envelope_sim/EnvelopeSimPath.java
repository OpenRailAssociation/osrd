package fr.sncf.osrd.envelope_sim;

import static fr.sncf.osrd.envelope_sim.TrainPhysicsIntegrator.arePositionsEqual;
import static fr.sncf.osrd.envelope_utils.RangeMapUtils.fullyCovers;

import com.google.common.collect.ImmutableRangeMap;
import com.google.common.collect.Range;
import com.google.common.collect.RangeMap;
import com.google.common.collect.TreeRangeMap;
import fr.sncf.osrd.envelope_sim.electrification.Electrification;
import java.util.Arrays;
import java.util.Map;

public final class EnvelopeSimPath implements PhysicsPath {
    public final double length;

    /** The grade curve points */
    private final double[] gradePositions;

    /** The grade values between each pair of consecutive points */
    private final double[] gradeValues;

    /** The cumulative sum of the gradient at each grade position */
    private final double[] gradeCumSum;

    /**
     * A mapping describing electrification on this path (without electrical profiles nor
     * restrictions)
     */
    private final ImmutableRangeMap<Double, Electrification> defaultElectrificationMap;

    /**
     * Mapping from rolling stock power class to mapping describing electrification on this path
     * (without restrictions)
     */
    private final Map<String, ImmutableRangeMap<Double, Electrification>> electrificationMapByPowerClass;

    /**
     * Creates a new envelope path, which can be used to perform envelope simulations.
     *
     * @param length the length of the path
     * @param gradePositions the points at which the grade (slope) changes
     * @param gradeValues the values between consecutive pairs of grade positions
     * @param defaultElectrificationMap mapping from distance to electrification conditions
     * @param electrificationMapByPowerClass mapping from rolling stock power class to mapping from
     *     distance to electrification conditions
     */
    public EnvelopeSimPath(
            double length,
            double[] gradePositions,
            double[] gradeValues,
            ImmutableRangeMap<Double, Electrification> defaultElectrificationMap,
            Map<String, ImmutableRangeMap<Double, Electrification>> electrificationMapByPowerClass) {
        assert gradePositions.length == gradeValues.length + 1;
        assert gradePositions[0] == 0.0;
        assert gradePositions[gradePositions.length - 1] == length;
        for (int i = 0; i < gradePositions.length - 1; i++) assert gradePositions[i] < gradePositions[i + 1];
        this.gradePositions = gradePositions;
        this.gradeValues = gradeValues;
        this.length = length;
        this.gradeCumSum = initCumSum(gradePositions, gradeValues);
        assert fullyCovers(defaultElectrificationMap, length) : "default electrification map does not cover path";
        this.defaultElectrificationMap = defaultElectrificationMap;
        for (var entry : electrificationMapByPowerClass.entrySet())
            assert fullyCovers(entry.getValue(), length)
                    : "electrification map for power class " + entry.getKey() + " does not cover path";
        this.electrificationMapByPowerClass = electrificationMapByPowerClass;
    }

    private double[] initCumSum(double[] gradePositions, double[] gradeValues) {
        var result = new double[gradePositions.length];
        result[0] = 0.0;
        double cumSum = 0;
        for (int i = 0; i < gradePositions.length - 1; i++) {
            var rangeLength = gradePositions[i + 1] - gradePositions[i];
            cumSum += gradeValues[i] * rangeLength;
            result[i + 1] = cumSum;
        }
        return result;
    }

    @Override
    public double getLength() {
        return length;
    }

    private double getCumGrade(double position) {
        if (position > length && arePositionsEqual(position, length)) position = length;
        assert position <= length && position >= 0;
        var pointIndex = Arrays.binarySearch(gradePositions, position);
        if (pointIndex >= 0) return gradeCumSum[pointIndex];

        // when the position isn't found, binarySearch returns -(insertion point) - 1
        var insertionPoint = -(pointIndex + 1);

        // return the cumulative gradient at the point before the given position, plus the gradient
        // change since then
        var gradeRangeIndex = insertionPoint - 1;
        var gradeRangeStart = gradePositions[gradeRangeIndex];
        return gradeCumSum[gradeRangeIndex] + gradeValues[gradeRangeIndex] * (position - gradeRangeStart);
    }

    @Override
    public double getAverageGrade(double begin, double end) {
        if (begin == end) return getCumGrade(begin);
        return (getCumGrade(end) - getCumGrade(begin)) / (end - begin);
    }

    private RangeMap<Double, Electrification> getModeAndProfileMap(
            String powerClass, Range<Double> range, boolean ignoreElectricalProfiles) {
        if (ignoreElectricalProfiles) powerClass = null;
        return electrificationMapByPowerClass
                .getOrDefault(powerClass, defaultElectrificationMap)
                .subRangeMap(range);
    }

    /** Get the electrification related data for a given power class and power restriction map. */
    public ImmutableRangeMap<Double, Electrification> getElectrificationMap(
            String basePowerClass,
            RangeMap<Double, String> powerRestrictionMap,
            Map<String, String> powerRestrictionToPowerClass,
            boolean ignoreElectricalProfiles) {

        TreeRangeMap<Double, Electrification> res = TreeRangeMap.create();
        res.putAll(getModeAndProfileMap(basePowerClass, Range.closed(0.0, length), ignoreElectricalProfiles));

        if (powerRestrictionMap != null) {
            for (var entry : powerRestrictionMap.asMapOfRanges().entrySet()) {
                var restriction = entry.getValue();
                var powerClass = powerRestrictionToPowerClass.getOrDefault(restriction, basePowerClass);
                var modeAndProfileMap = getModeAndProfileMap(powerClass, entry.getKey(), ignoreElectricalProfiles);
                for (var modeAndProfileEntry : modeAndProfileMap.asMapOfRanges().entrySet()) {
                    var electrification = modeAndProfileEntry.getValue();
                    res.putCoalescing(modeAndProfileEntry.getKey(), electrification.withPowerRestriction(restriction));
                }
            }
        }
        return ImmutableRangeMap.copyOf(res);
    }

    /** Get the electrification related data for a given power class and power restriction map. */
    public ImmutableRangeMap<Double, Electrification> getElectrificationMap(
            String basePowerClass,
            RangeMap<Double, String> powerRestrictionMap,
            Map<String, String> powerRestrictionToPowerClass) {
        return getElectrificationMap(basePowerClass, powerRestrictionMap, powerRestrictionToPowerClass, false);
    }
}
