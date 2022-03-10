package fr.sncf.osrd.utils.geom;

import com.carrotsearch.hppc.DoubleArrayList;
import com.squareup.moshi.*;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

public class LineString {

    /** A list of N coordinates (X component) */
    private final double[] bufferX;
    /** A list of N coordinates (Y component) */
    private final double[] bufferY;
    /** A cumulative list of N-1 distances between coordinates */
    private final double[] cumulativeLengths;

    private LineString(double[] bufferX, double[] bufferY, double[] cumulativeLengths) {
        assert bufferX.length == bufferY.length : "Expected the same length";
        assert bufferX.length >= 2 : "LineString should contain at least 2 points";
        assert cumulativeLengths.length == bufferX.length - 1;
        this.bufferX = bufferX;
        this.bufferY = bufferY;
        this.cumulativeLengths = cumulativeLengths;
    }

    /**
     * Compute the distance between two points
     */
    private static double computeDistance(double x1, double y1, double x2, double y2) {
        var dx2 = (x1 - x2) * (x1 - x2);
        var dy2 = (y1 - y2) * (y1 - y2);
        return Math.sqrt(dx2 + dy2);
    }

    /**
     * Create a LineString from the coordinates buffers (no need to give lengths and cumulativeLength)
     * @param bufferX a double array with x coordinates
     * @param bufferY a double array with y coordinates
     * @return a new LineString
     */
    public static LineString make(double[] bufferX, double[] bufferY) {
        var cumulativeLengths = new double[bufferX.length - 1];
        double cumulativeLength = 0;
        for (int i = 0; i < bufferX.length - 1; i++) {
            cumulativeLength += computeDistance(bufferX[i], bufferY[i], bufferX[i + 1], bufferY[i + 1]);
            cumulativeLengths[i] = cumulativeLength;
        }
        return new LineString(bufferX, bufferY, cumulativeLengths);
    }

    public double getLength() {
        return cumulativeLengths[cumulativeLengths.length - 1];
    }

    /**
     * Create a list of points from the buffers of a LineString
     * @return a list of points
     */
    public ArrayList<Point> getPoints() {
        var points = new ArrayList<Point>();
        for (int i = 0; i < bufferX.length; i++) {
            points.add(new Point(bufferX[i], bufferY[i]));
        }
        return points;
    }

    /**
     * Reverse a LineString
     * @return a new reverse LineString
     */
    public LineString reverse() {
        var newBufferX = new double[bufferX.length];
        var newBufferY = new double[bufferY.length];

        for (int i = 0; i < bufferX.length; i++) {
            var revertI = bufferX.length - i - 1;
            newBufferX[i] = bufferX[revertI];
            newBufferY[i] = bufferY[revertI];
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

        return new LineString(newBufferX, newBufferY, newCumulativeLengths);
    }

    /**
     * Concatenate many LineStrings and Compute the new cumulativeLength
     * remove useless values (if 2 values are the same)
     * and compute the new length to fill the gap between two LineStrings
     * @param lineStringList is a list that contains LineStrings
     * @return a new LineString
     */
    public static LineString concatenate(List<LineString> lineStringList) {

        var newBufferX = new DoubleArrayList();
        var newBufferY = new DoubleArrayList();
        var newCumulativeLengths = new DoubleArrayList();

        for (var lineString : lineStringList) {
            if (!newBufferX.isEmpty()) {
                var distance = computeDistance(
                        newBufferX.get(newBufferX.size() - 1),
                        newBufferY.get(newBufferY.size() - 1),
                        lineString.bufferX[0],
                        lineString.bufferY[0]);

                if (distance < 1e-5) {
                    newBufferX.remove(newBufferX.size() - 1);
                    newBufferY.remove(newBufferY.size() - 1);
                } else {
                    newCumulativeLengths.add(distance + newCumulativeLengths.get(newCumulativeLengths.size() - 1));
                }
            }
            newBufferX.add(lineString.bufferX);
            newBufferY.add(lineString.bufferY);
            double lastCumulativeLength = 0;
            if (!newCumulativeLengths.isEmpty())
                lastCumulativeLength = newCumulativeLengths.get(newCumulativeLengths.size() - 1);
            for (var cumLength : lineString.cumulativeLengths)
                newCumulativeLengths.add(cumLength + lastCumulativeLength);

        }
        return new LineString(newBufferX.toArray(), newBufferY.toArray(), newCumulativeLengths.toArray());
    }

    /**
     * Interpolate a LineString
     * @param distance a distance between 0 and cumulativeLength
     * @return the point within the geometry at the given distance
     */
    private Point interpolate(double distance) {
        assert distance >= 0.;
        assert distance <= cumulativeLengths[cumulativeLengths.length - 1];
        var interval = Arrays.binarySearch(cumulativeLengths, distance);

        if (interval < 0)
            interval = - interval - 1;

        var x1 = bufferX[interval];
        var y1 = bufferY[interval];
        var x2 = bufferX[interval + 1];
        var y2 = bufferY[interval + 1];

        double ratio = distance / cumulativeLengths[0];

        if (interval > 0) {
            ratio = (distance - cumulativeLengths[interval - 1])
                    / (cumulativeLengths[interval] - cumulativeLengths[interval - 1]);
        }

        return new Point(x1 + ratio * (x2 - x1), y1 + ratio * (y2 - y1));
    }

    /**
     * Interpolate a LineString
     * @param distance normalize distance between 0 (origin) and 1 (endpoint)
     * @return the point within the geometry at the given distance
     */
    public Point interpolateNormalized(double distance) {
        assert distance <= 1;
        assert distance >= 0;
        return interpolate(distance * cumulativeLengths[cumulativeLengths.length - 1]);
    }

    /**
     * A troncate a LineString from begin to end
     * begin and end are distance on the LineString
     * begin and end are between 0.0 and 1.0
     */
    public LineString slice(double begin, double end) {
        assert begin >= 0 && begin <= 1;
        assert end >= 0 && end <= 1;
        assert Double.compare(begin, end) != 0;

        if (begin > end)
            return slice(end, begin).reverse();

        if (Double.compare(begin, 0) == 0 && Double.compare(end, 1) == 0)
            return this;

        var newBufferX = new DoubleArrayList();
        var newBufferY = new DoubleArrayList();

        var firstPoint = interpolateNormalized(begin);
        newBufferX.add(firstPoint.x());
        newBufferY.add(firstPoint.y());

        var intervalBegin = Arrays.binarySearch(
                cumulativeLengths,
                begin * cumulativeLengths[cumulativeLengths.length - 1]
        );
        if (intervalBegin >= 0)
            intervalBegin += 2;
        else
            intervalBegin = - intervalBegin;

        var intervalEnd = Arrays.binarySearch(
                cumulativeLengths,
                end * cumulativeLengths[cumulativeLengths.length - 1]
        );
        if (intervalEnd < 0)
            intervalEnd = - intervalEnd - 1;

        // add intermediate points
        for (int i = intervalBegin; i <= intervalEnd; i++) {
            newBufferX.add(bufferX[i]);
            newBufferY.add(bufferY[i]);
        }

        // add the last point
        var lastPoint = interpolateNormalized(end);
        newBufferX.add(lastPoint.x());
        newBufferY.add(lastPoint.y());

        return LineString.make(newBufferX.toArray(), newBufferY.toArray());
    }

    public static class Adapter extends JsonAdapter<LineString> {

        /**
         * Deserialize a GeoJson file into a LineString
         */
        @FromJson
        public LineString fromJson(JsonReader reader) throws IOException {
            LineString lineString = null;

            reader.beginObject();
            for (int i = 0; i < 2; i++) {
                var propertyName = reader.nextName();

                if (propertyName.equals("type")) {
                    var type = reader.nextString();
                    if (!type.equals("LineString"))
                        throw new JsonDataException(String.format("Expected a LineString got '%s'", type));
                } else if (propertyName.equals("coordinates")) {
                    if (lineString != null)
                        throw new JsonDataException("Geometry has same property name (coordinates)");

                    var bufferX = new DoubleArrayList();
                    var bufferY = new DoubleArrayList();

                    reader.beginArray();
                    while (reader.hasNext()) {
                        reader.beginArray();
                        bufferX.add(reader.nextDouble());
                        bufferY.add(reader.nextDouble());
                        reader.endArray();
                    }
                    reader.endArray();

                    lineString = LineString.make(bufferX.toArray(), bufferY.toArray());
                } else {
                    throw new JsonDataException(String.format("Unexpected geometry property '%s'", propertyName));
                }
            }
            reader.endObject();

            if (lineString == null)
                throw new JsonDataException("Missing coordinates property");

            return lineString;
        }

        /**
         * Serialize a LineString into a GeoJson file
         */
        @ToJson
        public void toJson(JsonWriter writer, LineString value) throws IOException {
            if (value == null) {
                writer.nullValue();
                return;
            }

            writer.beginObject();
            writer.name("type");
            writer.value("LineString");
            writer.name("coordinates");
            writer.beginArray();
            for (int i = 0; i < value.bufferX.length; i++) {
                writer.beginArray();
                writer.value(value.bufferX[i]);
                writer.value(value.bufferY[i]);
                writer.endArray();
            }
            writer.endArray();
            writer.endObject();
        }
    }
}
