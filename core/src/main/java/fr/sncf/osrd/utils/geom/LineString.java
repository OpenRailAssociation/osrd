package fr.sncf.osrd.utils.geom;

import com.carrotsearch.hppc.DoubleArrayList;
import com.squareup.moshi.*;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

public class LineString {

    /**
     * A list of N coordinates (X component)
     */
    private final double[] bufferX;
    /**
     * A list of N coordinates (Y component)
     */
    private final double[] bufferY;
    /**
     * A list of N-1 distances between coordinates
     */
    private final double[] lengths;
    /**
     * Cached sum of distances
     */
    private final double cumulativeLength;

    private LineString(double[] bufferX, double[] bufferY, double[] lengths, double cumulativeLength) {
        assert bufferX.length == bufferY.length : "Expected the same length";
        assert bufferX.length >= 2 : "LineString should contain at least 2 points";
        assert lengths.length == bufferX.length - 1;
        this.bufferX = bufferX;
        this.bufferY = bufferY;
        this.lengths = lengths;
        this.cumulativeLength = cumulativeLength;
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
        var lengths = new double[bufferX.length - 1];
        double cumulativeLength = 0;
        for (int i = 0; i < bufferX.length - 1; i++) {
            lengths[i] = computeDistance(bufferX[i], bufferY[i], bufferX[i + 1], bufferY[i + 1]);
            cumulativeLength += lengths[i];
        }
        return new LineString(bufferX, bufferY, lengths, cumulativeLength);
    }

    public double getLength() {
        return cumulativeLength;
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

        var newLengths = new double[lengths.length];
        for (int i = 0; i < lengths.length; i++)
            newLengths[i] = lengths[lengths.length - i - 1];

        return new LineString(newBufferX, newBufferY, newLengths, cumulativeLength);
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
        var newLengths = new DoubleArrayList();
        double newCumulativeLength = 0;

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
                    newLengths.add(distance);
                    newCumulativeLength += distance;
                }
            }
            newBufferX.add(lineString.bufferX);
            newBufferY.add(lineString.bufferY);
            newLengths.add(lineString.lengths);
            newCumulativeLength += lineString.cumulativeLength;
        }

        return new LineString(newBufferX.toArray(), newBufferY.toArray(), newLengths.toArray(), newCumulativeLength);
    }

    /**
     * Interpolate a LineString
     * @param distance a distance between 0 and cumulativeLength
     * @return the point within the geometry at the given distance
     */
    private Point interpolate(double distance) {
        assert distance >= 0.;
        assert distance <= cumulativeLength;
        int interval = 0;
        while (interval < lengths.length - 1 && distance > lengths[interval]) {
            distance -= lengths[interval];
            interval++;
        }

        var x1 = bufferX[interval];
        var y1 = bufferY[interval];
        var x2 = bufferX[interval + 1];
        var y2 = bufferY[interval + 1];
        var ratio = distance / lengths[interval];

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
        return interpolate(distance * cumulativeLength);
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
        newBufferX.add(firstPoint.x);
        newBufferY.add(firstPoint.y);

        var intervalIndex = 1;
        var currentLength = lengths[0];
        // skip first points
        while (begin >= currentLength / cumulativeLength && intervalIndex < lengths.length) {
            currentLength += lengths[intervalIndex];
            intervalIndex++;
        }
        // add intermediate points
        while (currentLength / cumulativeLength < end && intervalIndex < lengths.length) {
            newBufferX.add(bufferX[intervalIndex]);
            newBufferY.add(bufferY[intervalIndex]);
            currentLength += lengths[intervalIndex];
            intervalIndex++;
        }
        // add the last point

        var lastPoint = interpolateNormalized(end);
        newBufferX.add(lastPoint.x);
        newBufferY.add(lastPoint.y);

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
