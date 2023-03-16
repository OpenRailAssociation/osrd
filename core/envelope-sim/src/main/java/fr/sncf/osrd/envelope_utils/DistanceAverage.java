package fr.sncf.osrd.envelope_utils;

/** This class can be used to compute average values over distances,
 * adding segments iteratively. */
public class DistanceAverage {
    private double totalWeightedValue = 0;
    private double totalLength = 0;

    /** Add a segment of size `length`, with an average value of `value` */
    public void addSegment(double length, double value) {
        totalWeightedValue += value * length;
        totalLength += length;
    }

    /** Returns the average value over all the given segments */
    public double getAverage() {
        return totalWeightedValue / totalLength;
    }
}
