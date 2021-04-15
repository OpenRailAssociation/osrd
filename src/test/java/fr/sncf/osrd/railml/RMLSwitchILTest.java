package fr.sncf.osrd.railml;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.fail;

import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.railjson.schema.infra.RJSInfra;
import org.junit.jupiter.api.Test;

public class RMLSwitchILTest {

    @Test
    public void testRealData() {
        RJSInfra infra = null;
        try {
            ClassLoader classLoader = getClass().getClassLoader();
            var resource = classLoader.getResource("tiny_infra/infra.xml");
            if (resource == null) {
                fail("Can't load test resource");
                return;
            }
            var infraPath = resource.toString();
            infra = RailMLParser.parse(infraPath);
        } catch (InvalidInfraException e) {
            fail("XML reading should not have failed", e);
            return;
        }
        var switches = infra.switches;
        assertEquals(1, switches.size());
        var s = switches.iterator().next();
        assertEquals(6, s.positionChangeDelay);
        assertEquals("il.switch_foo", s.id);
    }
}
