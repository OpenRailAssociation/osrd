package fr.sncf.osrd.utils.geom;

import com.squareup.moshi.*;

import java.io.IOException;
import java.util.Objects;

public final class Point {
    /** Point x of coordinates */
    public final double x;

    /** Point y of coordinates */
    public final double y;

    public Point(double x, double y) {
        this.x = x;
        this.y = y;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || Point.class != o.getClass()) return false;
        var point = (Point) o;
        return Double.compare(point.x, x) == 0 && Double.compare(point.y, y) == 0;
    }

    @Override
    public int hashCode() {
        return Objects.hash(x, y);
    }

    public static class Adapter extends JsonAdapter<Point>{

        @FromJson
        public Point fromJson(JsonReader reader) throws IOException {
            Point point = null;

            reader.beginObject();
            for (int i = 0; i < 2; i++) {
                var propertyName = reader.nextName();

                if (propertyName.equals("type")) {
                    var type = reader.nextString();
                    if (!type.equals("Point"))
                        throw new JsonDataException(String.format("Expected a Point got '%s'", type));
                } else if (propertyName.equals("coordinates")) {
                    if (point != null)
                        throw new JsonDataException("Geometry has same property name (coordinates)");

                    reader.beginArray();
                    double x = reader.nextDouble();
                    double y = reader.nextDouble();
                    reader.endArray();

                    point = new Point(x, y);
                } else {
                    throw new JsonDataException(String.format("Unexpected geometry property '%s'", propertyName));
                }
            }
            reader.endObject();

            if (point == null)
                throw new JsonDataException("Missing coordinates property");

            return point;
        }

        @ToJson
        public void toJson(JsonWriter writer, Point value) throws IOException {
            if (value == null) {
                writer.nullValue();
                return;
            }
            writer.beginObject();
            writer.name("type");
            writer.value("Point");
            writer.name("coordinates");
            writer.beginArray();
            writer.value(value.x);
            writer.value(value.y);
            writer.endArray();
            writer.endObject();
        }
    }


}
