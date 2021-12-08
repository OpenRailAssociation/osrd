package fr.sncf.osrd.railjson.schema.infra;

import fr.sncf.osrd.infra.InvalidInfraException;
import java.util.List;

public class GeoData {
    List<List<Double>> coordinates;
    String type;

    public GeoData() {
        this(List.of(List.of()), "");
    }

    public GeoData(List<List<Double>> coordinates, String type) {
        this.coordinates = coordinates;
        this.type = type;
    }

    /** Get the geo data as a point */
    public List<Double> getPoint() throws InvalidInfraException {
        if (!type.equals("Point"))
            throw new InvalidInfraException("Invalid geo type, expected Point, got " + type);
        return coordinates.get(0);
    }

    /** Get the geo data as a sequence of points */
    public List<List<Double>> getLine() throws InvalidInfraException {
        if (!type.equals("LineString"))
            throw new InvalidInfraException("Invalid geo type, expected LineString, got " + type);
        return coordinates;
    }
}
