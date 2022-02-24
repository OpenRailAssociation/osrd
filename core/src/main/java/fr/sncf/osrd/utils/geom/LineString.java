
package fr.sncf.osrd.utils.geom;

import com.carrotsearch.hppc.DoubleArrayList;
import com.squareup.moshi.*;

import java.io.IOException;
import java.sql.Array;
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


    private static double computeDistance(double x1, double y1, double x2, double y2) {
        var dx2 = (x1 - x2) * (x1 - x2);
        var dy2 = (y1 - y2) * (y1 - y2);
        return Math.sqrt(dx2 + dy2);
    }

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

    public ArrayList<Point> getPoints() {
        var points = new ArrayList<Point>();
        for (int i = 0; i < bufferX.length; i++) {
            points.add(new Point(bufferX[i], bufferY[i]));
        }
        return points;
    }

    private Point interpolate(double distance) {
        assert distance >= 0.;
        assert distance <= cumulativeLength;
        int interval = 0;
        while (distance <= lengths[interval]) {
            distance -= lengths[interval];
            interval++;
        }

        var x1 = bufferX[interval];
        var y1 = bufferY[interval];
        var x2 = bufferX[interval + 1];
        var y2 = bufferY[interval + 1];
        var ratio = distance / lengths[interval];

        return new Point(x1 + ratio * (x2 -x1),y1 + ratio * (y2- y1));
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

    public static class Adapter extends JsonAdapter<LineString> {

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
