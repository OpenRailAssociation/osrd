package fr.sncf.osrd.railjson.schema.geom;

import com.squareup.moshi.*;
import java.io.IOException;
import org.gavaghan.geodesy.*;

public record Point (
        // Longitude
        double x,
        // Latitude
        double y
) {
    public static final JsonAdapter<Point> adapter = new Adapter();

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

    /** Returns the distance between this point and another in meters,
     * assuming x = longitude and y = latitude */
    public double distanceAsMeters(Point other) {
        GeodeticCalculator geoCalc = new GeodeticCalculator();
        Ellipsoid reference = Ellipsoid.WGS84;
        GlobalPosition thisPosition = new GlobalPosition(y, x, 0.0);
        GlobalPosition otherPosition = new GlobalPosition(other.y, other.x, 0.0);
        return geoCalc.calculateGeodeticCurve(reference, thisPosition, otherPosition).getEllipsoidalDistance();
    }

    @Override
    public String toString() {
        return adapter.toJson(this);
    }
}
