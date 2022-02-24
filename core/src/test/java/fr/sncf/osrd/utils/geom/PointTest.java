package fr.sncf.osrd.utils.geom;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.Test;
import java.io.IOException;

class PointTest {
    @Test
    public void testDeserialize() throws IOException {
        var geoJson = "{\"type\": \"Point\", \"coordinates\": [6.3281, 46.6192]}";
        var adapter = new Point.Adapter();
        var point = adapter.fromJson(geoJson);
        assertEquals(point.x, 6.3281);
        assertEquals(point.y, 46.6192);
    }

    @Test
    public void testSerialize() throws IOException {
        var point = new Point(1.21, 4.9865);
        var adapter = new Point.Adapter();
        var geoJson = adapter.toJson(point);
        var expectedGeoJson = "{\"type\":\"Point\",\"coordinates\":[1.21,4.9865]}";
        assertEquals(expectedGeoJson, geoJson);
    }
}