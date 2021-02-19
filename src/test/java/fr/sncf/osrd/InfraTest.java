package fr.sncf.osrd;

import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.infra.InvalidInfraException;
import org.junit.jupiter.api.Test;

class InfraTest {
    @Test
    public void simpleInfraBuild() throws InvalidInfraException {
        var infraBuilder = new Infra.Builder();
        var nodeA = infraBuilder.trackGraph.makePlaceholderNode("A");
        var nodeB = infraBuilder.trackGraph.makePlaceholderNode("B");
        infraBuilder.trackGraph.makeTrackSection(nodeA.getIndex(), nodeB.getIndex(), "e1", 42);
        infraBuilder.build();
    }
}
