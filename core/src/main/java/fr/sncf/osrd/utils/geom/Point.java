package fr.sncf.osrd.utils.geom;

import com.squareup.moshi.*;
import java.io.IOException;

public record Point (double x, double y) {

    public static class Adapter extends JsonAdapter<Point> {

        /**
         * Deserialize a GeoJson file into a point
         */
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

        /**
         * Serialize a Point into a GeoJson file
         */
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
