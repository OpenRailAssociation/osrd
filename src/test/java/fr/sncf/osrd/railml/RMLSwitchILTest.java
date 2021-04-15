package fr.sncf.osrd.railml;

import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.railjson.schema.infra.RJSInfra;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

public class RMLSwitchILTest {

    @Test
    public void testRealData() {
        RJSInfra infra = null;
        try {
            ClassLoader classLoader = getClass().getClassLoader();
            var resource = classLoader.getResource("tiny_infra/infra.xml");
            if (resource == null)
                fail("Can't load test resource");
            var infraPath = resource.toString();
            infra = RailMLParser.parse(infraPath);
        } catch (InvalidInfraException e) {
            fail("XML reading should not have failed", e);
        }
        var switches = infra.switches;
        assertEquals(1, switches.size());
        var s = switches.iterator().next();
        assertEquals(6, s.positionChangeDelay);
        assertEquals("il.switch_foo", s.id);
    }
}
