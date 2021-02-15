package fr.sncf.osrd;

import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.infra.InvalidInfraException;
import org.junit.jupiter.api.Test;

class InfraTest {
    @Test
    public void simpleInfraBuild() throws InvalidInfraException {
        var infra = new Infra();
        var nodeA = infra.makePlaceholderNode("A");
        var nodeB = infra.makePlaceholderNode("B");
        infra.makeTrackSection(nodeA.getIndex(), nodeB.getIndex(), "e1", 42);
        infra.prepare();
    }
}
