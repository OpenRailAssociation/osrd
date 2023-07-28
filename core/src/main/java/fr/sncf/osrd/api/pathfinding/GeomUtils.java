package fr.sncf.osrd.api.pathfinding;

import fr.sncf.osrd.geom.LineString;
import fr.sncf.osrd.railjson.schema.geom.RJSLineString;
import java.util.ArrayList;
import java.util.List;

public class GeomUtils {
    static RJSLineString toRJSLineString(LineString lineString) {
        var coordinates = new ArrayList<List<Double>>();
        for (var p : lineString.getPoints())
            coordinates.add(List.of(p.x(), p.y()));
        return new RJSLineString("LineString", coordinates);
    }
}
