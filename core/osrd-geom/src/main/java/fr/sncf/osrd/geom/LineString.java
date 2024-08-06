package fr.sncf.osrd.geom;

import com.carrotsearch.hppc.DoubleArrayList;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

public final class LineString {

    /** A list of N coordinates (X component, longitude) */
    private final double[] bufferLon;

    /** A list of N coordinates (Y component, latitude) */
    private final double[] bufferLat;

    /** A cumulative list of N-1 distances between coordinates */
    private final double[] cumulativeLengths;

    private LineString(double[] bufferLat, double[] bufferLon, double[] cumulativeLengths) {
        assert bufferLon.length == bufferLat.length : "Expected the same length";
        assert bufferLon.length >= 2 : "LineString should contain at least 2 points";
        assert cumulativeLengths.length == bufferLon.length - 1;
        this.bufferLon = bufferLon;
        this.bufferLat = bufferLat;
        this.cumulativeLengths = cumulativeLengths;
    }

    /**
     * Create a LineString from the coordinates buffers (no need to give lengths and
     * cumulativeLength)
     *
     * @param bufferLat a double array with latitude coordinates
     * @param bufferLon a double array with longitude coordinates
     * @return a new LineString
     */
    public static LineString make(double[] bufferLat, double[] bufferLon) {
        var cumulativeLengths = new double[bufferLon.length - 1];
        double cumulativeLength = 0;
        for (int i = 0; i < bufferLon.length - 1; i++) {
            cumulativeLength += new Point(bufferLat[i], bufferLon[i])
                    .distanceAsMeters(new Point(bufferLat[i + 1], bufferLon[i + 1]));
            cumulativeLengths[i] = cumulativeLength;
        }
        return new LineString(bufferLat, bufferLon, cumulativeLengths);
    }

    /** Create a LineString from two points */
    public static LineString make(Point start, Point end) {
        return make(new double[] {start.lat(), end.lat()}, new double[] {start.lon(), end.lon()});
    }

    public double getLength() {
        return cumulativeLengths[cumulativeLengths.length - 1];
    }

    /**
     * Create a list of points from the buffers of a LineString
     *
     * @return a list of points
     */
    public ArrayList<Point> getPoints() {
        var points = new ArrayList<Point>();
        for (int i = 0; i < bufferLon.length; i++) {
            points.add(new Point(bufferLat[i], bufferLon[i]));
        }
        return points;
    }

    /**
     * Reverse a LineString
     *
     * @return a new reverse LineString
     */
    public LineString reverse() {
        var newBufferLon = new double[bufferLon.length];
        var newBufferLat = new double[bufferLat.length];

        for (int i = 0; i < bufferLon.length; i++) {
            var revertI = bufferLon.length - i - 1;
            newBufferLon[i] = bufferLon[revertI];
            newBufferLat[i] = bufferLat[revertI];
        }

        var newCumulativeLengths = new double[cumulativeLengths.length];
        double newCumulativeLength = 0;
        for (int i = 0; i < cumulativeLengths.length - 1; i++) {
            newCumulativeLength += cumulativeLengths[cumulativeLengths.length - i - 1]
                    - cumulativeLengths[cumulativeLengths.length - i - 2];
            newCumulativeLengths[i] = newCumulativeLength;
        }
        newCumulativeLength += cumulativeLengths[0];
        newCumulativeLengths[newCumulativeLengths.length - 1] = newCumulativeLength;

        return new LineString(newBufferLat, newBufferLon, newCumulativeLengths);
    }

    /**
     * Concatenate many LineStrings and Compute the new cumulativeLength remove useless values (if 2
     * values are the same) and compute the new length to fill the gap between two LineStrings
     *
     * @param lineStringList is a list that contains LineStrings
     * @return a new LineString
     */
    public static LineString concatenate(List<LineString> lineStringList) {

        var newBufferLon = new DoubleArrayList();
        var newBufferLat = new DoubleArrayList();
        var newCumulativeLengths = new DoubleArrayList();

        for (var lineString : lineStringList) {
            if (!newBufferLon.isEmpty()) {
                var distance = new Point(
                                newBufferLat.get(newBufferLat.size() - 1), newBufferLon.get(newBufferLon.size() - 1))
                        .distanceAsMeters(new Point(lineString.bufferLat[0], lineString.bufferLon[0]));

                if (distance < 1e-5) {
                    newBufferLon.remove(newBufferLon.size() - 1);
                    newBufferLat.remove(newBufferLat.size() - 1);
                } else {
                    newCumulativeLengths.add(distance + newCumulativeLengths.get(newCumulativeLengths.size() - 1));
                }
            }
            newBufferLon.add(lineString.bufferLon);
            newBufferLat.add(lineString.bufferLat);
            double lastCumulativeLength = 0;
            // used to add the length of the previous Linestring to make the lengths of the next one
            // cumulatives
            if (!newCumulativeLengths.isEmpty())
                lastCumulativeLength = newCumulativeLengths.get(newCumulativeLengths.size() - 1);
            for (var cumLength : lineString.cumulativeLengths)
                newCumulativeLengths.add(cumLength + lastCumulativeLength);
        }
        return new LineString(newBufferLat.toArray(), newBufferLon.toArray(), newCumulativeLengths.toArray());
    }

    /**
     * Interpolate a LineString
     *
     * @param distance a distance between 0 and cumulativeLength
     * @return the point within the geometry at the given distance
     */
    private Point interpolate(double distance) {
        assert distance >= 0.;
        assert distance <= cumulativeLengths[cumulativeLengths.length - 1];

        // if we're at the first point
        if (distance == 0.) return new Point(bufferLat[0], bufferLon[0]);

        var intervalIndex = Arrays.binarySearch(cumulativeLengths, distance);

        // if we're exactly on any other point
        if (intervalIndex >= 0) return new Point(bufferLat[intervalIndex + 1], bufferLon[intervalIndex + 1]);

        // if we're in-between points
        intervalIndex = -intervalIndex - 1;

        // A -- P ---- B
        double startToA = intervalIndex > 0 ? cumulativeLengths[intervalIndex - 1] : 0;
        double startToB = cumulativeLengths[intervalIndex];
        double ab = startToB - startToA;
        double ap = distance - startToA;
        assert !Double.isNaN(ap);
        double ratio = ap / ab;

        var aLon = bufferLon[intervalIndex];
        var aLat = bufferLat[intervalIndex];

        // if ratio is undefined, A and B are the same point
        if (Double.isNaN(ratio)) return new Point(aLat, aLon);

        // clamp the linear interpolation ratio
        if (ratio < 0.) ratio = 0.;
        if (ratio > 1.) ratio = 1.;

        var bLon = bufferLon[intervalIndex + 1];
        var bLat = bufferLat[intervalIndex + 1];

        // FIXME: we can't just do a linear interpolation here
        return new Point(aLat + ratio * (bLat - aLat), aLon + ratio * (bLon - aLon));
    }

    /**
     * Interpolate a LineString
     *
     * @param distance normalize distance between 0 (origin) and 1 (endpoint)
     * @return the point within the geometry at the given distance
     */
    public Point interpolateNormalized(double distance) {
        assert distance <= 1;
        assert distance >= 0;
        return interpolate(distance * cumulativeLengths[cumulativeLengths.length - 1]);
    }

    /**
     * Truncate a LineString from the provided begin and end offsets begin and end are distance on
     * the LineString begin and end are between 0.0 and 1.0
     */
    public LineString slice(double begin, double end) {
        assert begin >= 0 && begin <= 1;
        assert end >= 0 && end <= 1;

        if (begin > end) return slice(end, begin).reverse();

        if (Double.compare(begin, 0) == 0 && Double.compare(end, 1) == 0) return this;

        var newBufferLon = new DoubleArrayList();
        var newBufferLat = new DoubleArrayList();

        var firstPoint = interpolateNormalized(begin);
        newBufferLon.add(firstPoint.lon());
        newBufferLat.add(firstPoint.lat());

        var intervalBegin =
                Arrays.binarySearch(cumulativeLengths, begin * cumulativeLengths[cumulativeLengths.length - 1]);

        // binarySearch returns a negative position if it doesn't find the element, else it returns
        // a positive index
        // interval + 1 gives us the index of the first element we wanted to add in our
        // slicedLinestring
        // But we already add the firstPoint above, so we go for the second element
        if (intervalBegin >= 0) intervalBegin += 2;
        else intervalBegin = -intervalBegin;

        var intervalEnd = Arrays.binarySearch(cumulativeLengths, end * cumulativeLengths[cumulativeLengths.length - 1]);
        if (intervalEnd < 0) intervalEnd = -intervalEnd - 1;

        // add intermediate points
        for (int i = intervalBegin; i <= intervalEnd; i++) {
            newBufferLon.add(bufferLon[i]);
            newBufferLat.add(bufferLat[i]);
        }

        // add the last point
        var lastPoint = interpolateNormalized(end);
        newBufferLon.add(lastPoint.lon());
        newBufferLat.add(lastPoint.lat());

        return LineString.make(newBufferLat.toArray(), newBufferLon.toArray());
    }

    @Override
    public String toString() {
        // The result can be imported as a WKT linestring
        // (e.g. can be logged to a CSV file and imported in QGIS)
        return "LINESTRING("
                + String.join(
                        ",",
                        getPoints().stream()
                                .map(it -> String.format("%s %s", it.lon(), it.lat()))
                                .toList())
                + ')';
    }
}
