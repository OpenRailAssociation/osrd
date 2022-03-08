package fr.sncf.osrd.utils.geom;

import static org.junit.jupiter.api.Assertions.*;

import com.squareup.moshi.JsonDataException;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import org.junit.jupiter.api.Test;
import java.io.IOException;
import java.util.ArrayList;

class LineStringTest {

    @Test
    public void testDeserialize() throws IOException {
        var geoJson = "{\"type\": "
                + "\"LineString\", "
                + "\"coordinates\": "
                + "[[3.2080078125, 49.439556958940855], "
                + "[4.04296875, 47.27922900257082], "
                + "[2.7685546874999996, 46.164614496897094], "
                + "[1.669921875, 44.213709909702054]]}";
        var adapter = new LineString.Adapter();
        var linestring = adapter.fromJson(geoJson);
        assertNotNull(linestring);
        assertEquals(6.248, linestring.getLength(), 0.001);
    }

    @Test
    public void testInvalidDeserialize() {
        var geoJson = "{\"type\": \"LineString\",\"type\": \"LineString\"}";
        var adapter = new LineString.Adapter();
        var thrown = assertThrows(JsonDataException.class, () -> assertNotNull(adapter.fromJson(geoJson)));
        assertEquals("Missing coordinates property", thrown.getMessage());
    }

    @Test
    public void testSerialize() {
        var linestring = LineString.make(new double[]{2., 3., 1., 1., 2.}, new double[]{44., 49., 44., 46., 47.});
        var adapter = new LineString.Adapter();
        var geoJson = adapter.toJson(linestring);
        var expectedGeoJson = "{\"type\":\"LineString\","
                + "\"coordinates\":[[2.0,44.0],[3.0,49.0],[1.0,44.0],[1.0,46.0],[2.0,47.0]]}";
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
    public void testConcatenate1() {
        var list = new ArrayList<LineString>();
        list.add(LineString.make(new double[]{1.0, 4.0}, new double[]{2.0, 4.0}));
        list.add(LineString.make(new double[]{4.0, 3.0}, new double[]{4.0, 3.0}));
        list.add(LineString.make(new double[]{3.0, 4.0, 3.0}, new double[]{1.0, 4.0, 3.0}));
        var expectedLineString = LineString.make(
                new double[]{1.0, 4.0, 3.0, 3.0, 4.0, 3.0},
                new double[]{2.0, 4.0, 3.0, 1.0, 4.0, 3.0});
        assertEquals(expectedLineString.getPoints(), LineString.concatenate(list).getPoints());
    }

    @Test
    public void testConcatenate2() {
        var list = new ArrayList<LineString>();
        list.add(LineString.make(new double[]{1.0, 4.0}, new double[]{2.0, 4.0}));
        var expectedLineString = LineString.make(new double[]{1.0, 4.0}, new double[]{2.0, 4.0});
        assertEquals(expectedLineString.getPoints(), LineString.concatenate(list).getPoints());
    }

    @Test
    public void testInterpolateNormalized1() {
        var lineString = LineString.make(new double[]{1.0, 2.0, 3.0}, new double[]{2.0, 3.0, 4.0});
        var expectedPoint = new Point(1.0, 2.0);
        assertEquals(expectedPoint, lineString.interpolateNormalized(0));
    }

    @Test
    public void testInterpolateNormalized2() {
        var lineString = LineString.make(new double[]{1.0, 2.0, 3.0}, new double[]{2.0, 3.0, 4.0});
        var expectedPoint = new Point(3.0, 4.0);
        assertEquals(expectedPoint, lineString.interpolateNormalized(1));
    }

    @Test
    public void testInterpolateNormalized3() {
        var lineString = LineString.make(new double[]{1.0, 2.0, 3.0}, new double[]{2.0, 3.0, 4.0});
        var expectedPoint = new Point(2.0, 3.0);
        assertEquals(expectedPoint, lineString.interpolateNormalized(0.5));
    }

    @Test
    public void testInterpolateNormalized4() {
        var lineString = LineString.make(new double[]{1.0, 2.0, 3.0, 4.0}, new double[]{2.0, 3.0, 4.0, 5.0});
        var expectedPoint = new Point(4.0, 5.0);
        assertEquals(expectedPoint, lineString.interpolateNormalized(1.0));
    }

    @Test
    public void testLineStringSlicePoints1() {
        var lineString = LineString.make(new double[]{1.0, 2.0, 3.0}, new double[]{2.0, 3.0, 4.0});
        var newLineString = lineString.slice(0, 1);
        var expectedLinestring = LineString.make(new double[]{1.0, 2.0, 3.0}, new double[]{2.0, 3.0, 4.0});
        assertEquals(expectedLinestring.getPoints(), newLineString.getPoints());
        assertEquals(expectedLinestring.getLength(), newLineString.getLength());
    }

    @Test
    public void testLineStringSlicePoints2() {
        var lineString = LineString.make(new double[]{1.0, 2.0, 3.0, 4.0, 5.0}, new double[]{2.0, 3.0, 4.0, 5.0, 6.0});
        var newLineString = lineString.slice(0.25, 1);
        var expectedLinestring = LineString.make(new double[]{2.0, 3.0, 4.0, 5.0}, new double[]{3.0, 4.0, 5.0, 6.0});
        assertEquals(expectedLinestring.getPoints(), newLineString.getPoints());
        assertEquals(expectedLinestring.getLength(), newLineString.getLength());
    }

    @Test
    public void testLineStringSlicePoints3() {
        var lineString = LineString.make(new double[]{1.0, 2.0, 3.0, 4.0, 5.0}, new double[]{2.0, 3.0, 4.0, 5.0, 6.0});
        var newLineString = lineString.slice(0, 0.75);
        var expectedLinestring = LineString.make(new double[]{1.0, 2.0, 3.0, 4.0}, new double[]{2.0, 3.0, 4.0, 5.0});
        assertEquals(expectedLinestring.getPoints(), newLineString.getPoints());
        assertEquals(expectedLinestring.getLength(), newLineString.getLength());
    }

    @Test
    public void testLineStringSlicePoints4() {
        var lineString = LineString.make(new double[]{1.0, 2.0, 3.0, 4.0, 5.0}, new double[]{2.0, 3.0, 4.0, 5.0, 6.0});
        var newLineString = lineString.slice(0.25, 0.75);
        var expectedLinestring = LineString.make(new double[]{2.0, 3.0, 4.0}, new double[]{3.0, 4.0, 5.0});
        assertEquals(expectedLinestring.getPoints(), newLineString.getPoints());
        assertEquals(expectedLinestring.getLength(), newLineString.getLength());
    }

    @Test
    public void testLineStringSlicePointsReverse() {
        var lineString = LineString.make(new double[]{1.0, 2.0, 3.0, 4.0, 5.0}, new double[]{2.0, 3.0, 4.0, 5.0, 6.0});
        var newLineString = lineString.slice(0.75, 0.25);
        var expectedLinestring = LineString.make(new double[]{4.0, 3.0, 2.0}, new double[]{5.0, 4.0, 3.0});
        assertEquals(expectedLinestring.getPoints(), newLineString.getPoints());
        assertEquals(expectedLinestring.getLength(), newLineString.getLength());
    }
}