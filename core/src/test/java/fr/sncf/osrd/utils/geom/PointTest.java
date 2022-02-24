package fr.sncf.osrd.utils.geom;

import fr.sncf.osrd.utils.geom.Point;
import org.junit.jupiter.api.Test;

import java.io.IOException;

class PointTest {
    @Test
    public void testDeserialize() throws IOException {
        var geoJson = "{\"type\": \"Point\", \"coordinates\": [6.328125, 46.619261036171515]}";
        var adapter = new Point.Adapter();
        var point = adapter.fromJson(geoJson);
    }
}