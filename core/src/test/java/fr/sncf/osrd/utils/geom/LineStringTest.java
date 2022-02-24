package fr.sncf.osrd.utils.geom;

import com.squareup.moshi.JsonDataException;
import fr.sncf.osrd.simulation.changelog.ArrayChangeLog;
import fr.sncf.osrd.utils.geom.LineString;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class LineStringTest {

    @Test
    public void testDeserialize() throws IOException {
        var geoJson = "{\"type\": \"LineString\", \"coordinates\": [[3.2080078125, 49.439556958940855], [4.04296875, 47.27922900257082], [2.7685546874999996, 46.164614496897094], [1.669921875, 44.213709909702054]]}";
        var adapter = new LineString.Adapter();
        var linestring = adapter.fromJson(geoJson);
        assertNotNull(linestring);
        assertEquals(6.248, linestring.getLength(), 0.001);
    }

    @Test
    public void testInvalidDeserialize() {
        var geoJson = "{\"type\": \"LineString\",\"type\": \"LineString\"}";
        var adapter = new LineString.Adapter();
        var thrown = assertThrows(JsonDataException.class, () -> adapter.fromJson(geoJson));
        assertEquals("Missing coordinates property", thrown.getMessage());
    }

    @Test
    public void testSerialize() {
        var linestring = LineString.make(new double[]{2., 3., 1., 1., 2.}, new double[]{44., 49., 44., 46., 47.});
        var adapter = new LineString.Adapter();
        var geoJson = adapter.toJson(linestring);
        var expectedGeoJson = "{\"type\":\"LineString\",\"coordinates\":[[2.0,44.0],[3.0,49.0],[1.0,44.0],[1.0,46.0],[2.0,47.0]]}";
        assertEquals(expectedGeoJson, geoJson);
    }

    @Test
    public void testSerializeNull() {
        var adapter = new LineString.Adapter();
        var geoJson = adapter.toJson(null);
        assertEquals("null", geoJson);
    }

    @Test
    public void testReverse() {
        var lineString = LineString.make(new double[]{1.0, 4.0, 3.0}, new double[]{2.0, 4.0, 3.0});
        var expectedLineString = LineString.make(new double[]{3.0, 4.0, 1.0}, new double[]{3.0, 4.0, 2.0});
        assertEquals(expectedLineString.getPoints(), lineString.reverse().getPoints());
    }

    @Test
    public void testConcatenate() {
        var list = new ArrayList<LineString>();
        list.add(LineString.make(new double[]{1.0, 4.0}, new double[]{2.0, 4.0}));
        list.add(LineString.make(new double[]{4.0, 3.0}, new double[]{4.0, 3.0}));
        list.add(LineString.make(new double[]{3.0, 4.0, 3.0}, new double[]{1.0, 4.0, 3.0}));

        var expectedLineString = LineString.make(new double[]{1.0, 4.0, 3.0, 3.0, 4.0, 3.0}, new double[]{2.0, 4.0, 3.0, 1.0, 4.0, 3.0});
        assertEquals(expectedLineString.getPoints(), LineString.concatenate(list).getPoints());
    }
}