package fr.sncf.osrd.railml;

import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.railjson.schema.infra.RJSInfra;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

public class RMLSwitchILTest {

    @Test
    public void testRealData() {
        String inputPath = "examples/tiny_infra/infra.xml";
        RJSInfra infra = null;
        try {
            infra = RailMLParser.parse(inputPath);
        } catch (InvalidInfraException e) {
            fail("XML reading should not have failed");
        }
        var switches = infra.switches;
        assertEquals(1, switches.size());
        var s = switches.iterator().next();
        assertEquals(6000, s.positionChangeDelay);
        assertEquals("il.switch_foo", s.id);
    }
}
