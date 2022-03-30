package fr.sncf.osrd.envelope_sim;

import java.util.Arrays;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;

public class EnvelopePath implements PhysicsPath {
    public final double length;

    /** The grade curve points */
    private final double[] gradePositions;
    /** The grade values between each pair of consecutive points */
    private final double[] gradeValues;
    /** The cumulative sum of the gradient at each grade position */
    private final double[] gradeCumSum;

    /**
     * Creates a new envelope path, which can be used to perform envelope simulations.
     * @param length the length of the path
     * @param gradePositions the points at which the grade (slope) changes
     * @param gradeValues the values between consecutive pairs of grande positions
     */
    @SuppressFBWarnings({"EI_EXPOSE_REP2"})
    public EnvelopePath(double length, double[] gradePositions, double[] gradeValues) {
        assert gradePositions.length == gradeValues.length + 1;
        assert gradePositions[0] == 0.0;
        assert gradePositions[gradePositions.length - 1] == length;
        for (int i = 0; i < gradePositions.length - 1; i++)
            assert gradePositions[i] < gradePositions[i + 1];
        this.gradePositions = gradePositions;
        this.gradeValues = gradeValues;
        this.length = length;
        this.gradeCumSum = initCumSum(gradePositions, gradeValues);
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
    public double findHighGradePosition(double position, double endPos, double length, double gradeThreshold) {
        // TODO: skip sections which don't have high enough slopes
        while (position <= endPos) {
            var tailPosition = Math.max(0., position - length);
            var grade = getAverageGrade(tailPosition, position);
            if (grade >= gradeThreshold)
                return position;
            position += 1.0;
        }
        return endPos;
    }
}
