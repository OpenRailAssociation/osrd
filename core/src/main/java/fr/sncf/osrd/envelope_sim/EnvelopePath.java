package fr.sncf.osrd.envelope_sim;

import java.util.Arrays;

public class EnvelopePath implements PhysicsPath {
    public final double length;

    /** The grade curve points */
    private final double[] gradePositions;
    /** The grade values between each pair of consecutive points */
    private final double[] gradeValues;
    /** The cumulative sum of the gradient at each grade position */
    private final double[] gradeCumSum;

    public EnvelopePath(double length, double[] gradePositions, double[] gradeValues) {
        assert gradePositions.length == gradeValues.length + 1;
        assert gradePositions[0] == 0.0;
        assert gradePositions[gradePositions.length - 1] == length;
        this.gradePositions = gradePositions;
        this.gradeValues = gradeValues;
        this.length = length;
        this.gradeCumSum = initCumSum(gradePositions, gradeValues);
    }

    private double[] initCumSum(double[] gradePositions, double[] gradeValues) {
        var result = new double[gradePositions.length];
        result[0] = 0.0;
        var cumSum = 0;
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
        return (getCumGrade(end) - getCumGrade(begin)) / (end - begin);
    }

    @Override
    public double findHighGradePosition(double position, double endPos, double length, double gradeThreshold) {
        var pos = position;
        while (pos <= endPos) {
            var grade = getAverageGrade(pos - length, pos);
            if (grade >= gradeThreshold)
                return pos;
            pos++;
        }
        return endPos;
    }
}
