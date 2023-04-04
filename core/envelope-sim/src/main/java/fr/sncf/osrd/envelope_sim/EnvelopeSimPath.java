package fr.sncf.osrd.envelope_sim;

import static fr.sncf.osrd.envelope_sim.TrainPhysicsIntegrator.POSITION_EPSILON;

import com.google.common.collect.ImmutableRangeMap;
import com.google.common.collect.Range;
import com.google.common.collect.RangeMap;
import com.google.common.collect.TreeRangeMap;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;

public class EnvelopeSimPath implements PhysicsPath {
    public final double length;

    /**
     * The grade curve points
     */
    private final double[] gradePositions;
    /**
     * The grade values between each pair of consecutive points
     */
    private final double[] gradeValues;
    /**
     * The cumulative sum of the gradient at each grade position
     */
    private final double[] gradeCumSum;

    /**
     * A range map of modeAndProfiles containing only the catenary electrification modes
     */
    private final ImmutableRangeMap<Double, ModeAndProfile> catenaryModeMap;

    /**
     * Mapping from rolling stock power class to electrical profiles and catenary modes on this path
     */
    private HashMap<String, RangeMap<Double, ModeAndProfile>> modeAndProfileMapsByPowerClass = null;

    /**
     * Creates a new envelope path, which can be used to perform envelope simulations.
     *
     * @param length          the length of the path
     * @param gradePositions  the points at which the grade (slope) changes
     * @param gradeValues     the values between consecutive pairs of grade positions
     * @param catenaryModeMap range map of catenary modes
     */
    @SuppressFBWarnings({"EI_EXPOSE_REP2"})
    public EnvelopeSimPath(
            double length,
            double[] gradePositions,
            double[] gradeValues,
            RangeMap<Double, String> catenaryModeMap
    ) {
        assert gradePositions.length == gradeValues.length + 1;
        assert gradePositions[0] == 0.0;
        assert gradePositions[gradePositions.length - 1] == length;
        for (int i = 0; i < gradePositions.length - 1; i++)
            assert gradePositions[i] < gradePositions[i + 1];
        this.gradePositions = gradePositions;
        this.gradeValues = gradeValues;
        this.length = length;
        this.gradeCumSum = initCumSum(gradePositions, gradeValues);
        this.catenaryModeMap = initCatenaryModes(mergeRanges(catenaryModeMap));
    }

    private ImmutableRangeMap<Double, ModeAndProfile> initCatenaryModes(RangeMap<Double, String> catenaryModes) {
        TreeRangeMap<Double, ModeAndProfile> modeAndProfileMap = TreeRangeMap.create();
        for (var modeEntry : catenaryModes.asMapOfRanges().entrySet()) {
            modeAndProfileMap.put(modeEntry.getKey(), new ModeAndProfile(modeEntry.getValue(), null));
        }
        return ImmutableRangeMap.copyOf(modeAndProfileMap);
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
        if (position > length && Math.abs(position - length) < POSITION_EPSILON)
            position = length;
        assert position <= length && position >= 0;
        var pointIndex = Arrays.binarySearch(gradePositions, position);
        if (pointIndex >= 0)
            return gradeCumSum[pointIndex];

        // when the position isn't found, binarySearch returns -(insertion point) - 1
        var insertionPoint = -(pointIndex + 1);

        // return the cumulative gradient at the point before the given position, plus the gradient change since then
        var gradeRangeIndex = insertionPoint - 1;
        var gradeRangeStart = gradePositions[gradeRangeIndex];
        return gradeCumSum[gradeRangeIndex] + gradeValues[gradeRangeIndex] * (position - gradeRangeStart);
    }

    @Override
    public double getAverageGrade(double begin, double end) {
        if (begin == end)
            return getCumGrade(begin);
        return (getCumGrade(end) - getCumGrade(begin)) / (end - begin);
    }

    @Override
    public boolean isElectrified(double position) {
        return catenaryModeMap.get(position) != null;
    }

    /**
     * Add electrical profile data to the path
     */
    public void setElectricalProfiles(Map<String, RangeMap<Double, String>> electricalProfilesByPowerClass) {
        modeAndProfileMapsByPowerClass = new HashMap<>();

        for (var powerClassEntry : electricalProfilesByPowerClass.entrySet()) {
            var profileMap = mergeRanges(powerClassEntry.getValue());
            TreeRangeMap<Double, ModeAndProfile> profilesAndModes = TreeRangeMap.create();
            profilesAndModes.put(Range.closed(0.0, length), new ModeAndProfile(null, null));
            profilesAndModes.putAll(catenaryModeMap);

            for (var profileEntry : profileMap.asMapOfRanges().entrySet()) {
                for (var entry : catenaryModeMap.subRangeMap(profileEntry.getKey()).asMapOfRanges().entrySet()) {
                    var mode = entry.getValue().mode();
                    var profileLevel = profileEntry.getValue();
                    profilesAndModes.put(entry.getKey(), new ModeAndProfile(mode, profileLevel));
                }
            }
            modeAndProfileMapsByPowerClass.put(powerClassEntry.getKey(), ImmutableRangeMap.copyOf(profilesAndModes));
        }
    }

    public RangeMap<Double, ModeAndProfile> getModeAndProfileMap(String powerClass) {
        if (modeAndProfileMapsByPowerClass == null)
            return catenaryModeMap;
        return modeAndProfileMapsByPowerClass.getOrDefault(powerClass, catenaryModeMap);
    }

    /**
     * Returns a range map where the adjacent ranges of same values have been merged
     */
    static <T> RangeMap<Double, T> mergeRanges(RangeMap<Double, T> map) {
        TreeRangeMap<Double, T> result = TreeRangeMap.create();
        var entryIterator = map.asMapOfRanges().entrySet().iterator();
        if (!entryIterator.hasNext())
            return result;
        var currentEntry = entryIterator.next();
        var currentRange = currentEntry.getKey();
        var currentValue = currentEntry.getValue();
        while (entryIterator.hasNext()) {
            var nextEntry = entryIterator.next();
            var nextRange = nextEntry.getKey();
            var nextValue = nextEntry.getValue();
            if (currentValue.equals(nextValue) && currentRange.isConnected(nextRange)) {
                currentRange = Range.closedOpen(currentRange.lowerEndpoint(), nextRange.upperEndpoint());
            } else {
                result.put(currentRange, currentValue);
                currentRange = nextRange;
                currentValue = nextValue;
            }
        }
        result.put(currentRange, currentValue);
        return result;
    }

    /** The catenary electrification mode and the electrical profile level (if any) present at some position */
    public static final record ModeAndProfile(String mode, String profile) {}
}
