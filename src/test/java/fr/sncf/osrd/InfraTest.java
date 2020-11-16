package fr.sncf.osrd;

import static org.junit.jupiter.api.Assertions.*;

import fr.sncf.osrd.infra.*;
import org.junit.jupiter.api.Test;

class InfraTest {
    @Test
    public void simpleInfraBuild() throws DataIntegrityException {
        var line = new Line("test line", "1");
        var track = Track.createAndRegister(line, "1", "test track");
        var infra = new Infra();
        infra.register(line);

        var nodeA = new NoOpNode("A");
        var nodeB = new NoOpNode("B");
        var nodeC = new NoOpNode("C");
        infra.register(nodeA);
        infra.register(nodeB);
        infra.register(nodeC);
        infra.register(TopoEdge.link(
                nodeA, nodeA::addEdge,
                nodeB, nodeB::addEdge,
                track, "e1", 42.0));
    }
}
