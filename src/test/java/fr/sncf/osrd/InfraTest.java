package fr.sncf.osrd;

import static org.junit.jupiter.api.Assertions.*;

import fr.sncf.osrd.infra.*;
import org.junit.jupiter.api.Test;

class InfraTest {
    @Test
    public void simpleInfraBuild() throws DataIntegrityException {
        var infra = new Infra();
        var line = infra.makeLine("test line", "1");
        var track = Track.createAndRegister(line, "1", "test track");

        var nodeA = infra.makeNoOpNode("A");
        var nodeB = infra.makeNoOpNode("B");
        var nodeC = infra.makeNoOpNode("C");
        infra.makeTopoLink(
                nodeA, nodeA::addEdge,
                nodeB, nodeB::addEdge,
                track, "e1", 42.0));
    }
}
