package fr.sncf.osrd;

import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.infra.TVDSection;
import fr.sncf.osrd.infra.signaling.Aspect;
import fr.sncf.osrd.infra.trackgraph.TrackGraph;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.HashMap;

class InfraTest {
    @Test
    public void simpleInfraBuild() throws InvalidInfraException {
        var trackGraph = new TrackGraph();

        var nodeA = trackGraph.makePlaceholderNode("A");
        var nodeB = trackGraph.makePlaceholderNode("B");
        trackGraph.makeTrackSection(nodeA.index, nodeB.index, "e1", 42);

        new Infra(trackGraph, null, null,
                new HashMap<>(), new HashMap<>(),
                new ArrayList<>(), new ArrayList<>());
    }
}
