package fr.sncf.osrd;

import fr.sncf.osrd.infra.*;
import org.junit.jupiter.api.Test;

class InfraTest {
    @Test
    public void simpleInfraBuild() throws InvalidInfraException {
        var infra = new Infra();
        var branch = infra.makeBranch("1", "test branch");
        var nodeA = infra.makeNoOpNode("A");
        var nodeB = infra.makeNoOpNode("B");
        infra.makeTopoLink(
                nodeA.getIndex(),
                nodeB.getIndex(),
                "e1", 42,
                branch, 0, 42.0);
    }
}
