package fr.sncf.osrd.infra.tracks.undirected;

import static com.google.common.collect.Iterables.contains;
import static fr.sncf.osrd.infra.InfraHelpers.getTrack;
import static fr.sncf.osrd.infra.InfraHelpers.toUndirected;
import static fr.sncf.osrd.utils.RangeMapUtils.equalsIgnoringTransitions;
import static org.junit.jupiter.api.Assertions.*;

import com.google.common.collect.*;
import com.google.common.graph.Traverser;
import fr.sncf.osrd.Helpers;
import fr.sncf.osrd.infra.api.Direction;
import fr.sncf.osrd.infra.api.tracks.undirected.SpeedLimits;
import fr.sncf.osrd.infra.errors.InvalidInfraError;
import fr.sncf.osrd.infra.implementation.tracks.undirected.UndirectedInfraBuilder;
import fr.sncf.osrd.railjson.schema.common.RJSObjectRef;
import fr.sncf.osrd.railjson.schema.common.graph.ApplicableDirection;
import fr.sncf.osrd.railjson.schema.common.graph.EdgeEndpoint;
import fr.sncf.osrd.railjson.schema.infra.RJSTrackEndpoint;
import fr.sncf.osrd.railjson.schema.infra.RJSTrackSectionLink;
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSApplicableDirectionsTrackRange;
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSSpeedSection;
import fr.sncf.osrd.reporting.warnings.StrictWarningError;
import fr.sncf.osrd.reporting.warnings.WarningRecorderImpl;
import org.junit.jupiter.api.Test;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public class RJSParsingTests {

    @Test
    public void testTinyInfra() throws Exception {
        var rjsInfra = Helpers.getExampleInfra("tiny_infra/infra.json");
        var infra = UndirectedInfraBuilder.parseInfra(rjsInfra, new WarningRecorderImpl(true));
        var graph = toUndirected(infra.getTrackGraph());
        var traverser = Traverser.forGraph(graph);
        var fooAEndpoint = graph.incidentNodes(getTrack(infra, "ne.micro.foo_a")).nodeU();
        var fooBEndpoint = graph.incidentNodes(getTrack(infra, "ne.micro.foo_b")).nodeU();
        var barAEndpoint = graph.incidentNodes(getTrack(infra, "ne.micro.bar_a")).nodeU();

        // Everything should be connected (undirected graph)
        assertTrue(contains(traverser.breadthFirst(fooAEndpoint), barAEndpoint));
        assertTrue(contains(traverser.breadthFirst(barAEndpoint), fooBEndpoint));
        assertTrue(contains(traverser.breadthFirst(fooBEndpoint), fooAEndpoint));
    }

    @Test
    public void testDuplicatedSwitch() throws Exception {
        var rjsInfra = Helpers.getExampleInfra("tiny_infra/infra.json");
        rjsInfra.switches.add(rjsInfra.switches.iterator().next());
        assertThrows(
                StrictWarningError.class,
                () -> UndirectedInfraBuilder.parseInfra(rjsInfra, new WarningRecorderImpl(true))
        );
    }

    @Test
    public void testLinkOnSwitch() throws Exception {
        var rjsInfra = Helpers.getExampleInfra("tiny_infra/infra.json");
        var s = rjsInfra.switches.iterator().next();
        var ports = new ArrayList<>(s.ports.values());
        rjsInfra.trackSectionLinks.add(new RJSTrackSectionLink(
                "broken",
                ApplicableDirection.BOTH,
                ports.get(0),
                new RJSTrackEndpoint(new RJSObjectRef<>("ne.micro.bar_a", "TrackSection"), EdgeEndpoint.END)
        ));
        assertThrows(
                InvalidInfraError.class,
                () -> UndirectedInfraBuilder.parseInfra(rjsInfra, new WarningRecorderImpl(true))
        );
    }

    @Test
    public void testDuplicateDetector() throws Exception {
        var rjsInfra = Helpers.getExampleInfra("tiny_infra/infra.json");
        rjsInfra.detectors.add(rjsInfra.detectors.get(0));
        assertThrows(
                StrictWarningError.class,
                () -> UndirectedInfraBuilder.parseInfra(rjsInfra, new WarningRecorderImpl(true))
        );
    }

    @Test
    public void testUnlabeledLinks() throws Exception {
        var rjsInfra = Helpers.getExampleInfra("one_line/infra.json");
        for (var link : rjsInfra.trackSectionLinks)
            link.id = null;
        // We check that no warning or assertion is raised when importing the infra
        UndirectedInfraBuilder.parseInfra(rjsInfra, new WarningRecorderImpl(true));
    }

    @Test
    public void testOverlappingSpeedSections() throws Exception {
        var rjsInfra = Helpers.getExampleInfra("one_line/infra.json");
        var track = rjsInfra.trackSections.iterator().next();
        rjsInfra.speedSections = List.of(
                new RJSSpeedSection("id", 42, Map.of(
                        "category1", 10.,
                        "category2", 20.
                ), List.of(new RJSApplicableDirectionsTrackRange(
                        new RJSObjectRef<>(track.id, "TrackSection"),
                        ApplicableDirection.START_TO_STOP,
                        0,
                        10
                ))),
            new RJSSpeedSection("id", 45, Map.of(
                    "category2", 12.,
                    "category3", 17.
            ), List.of(new RJSApplicableDirectionsTrackRange(
                    new RJSObjectRef<>(track.id, "TrackSection"),
                    ApplicableDirection.START_TO_STOP,
                    5,
                    15
            )))
        );
        var parsedInfra = UndirectedInfraBuilder.parseInfra(rjsInfra, new WarningRecorderImpl(true));
        var expected = TreeRangeMap.<Double, SpeedLimits>create();
        expected.put(Range.closed(0., 5.), new SpeedLimits(42, ImmutableMap.of(
                "category1", 10.,
                "category2", 20.
        )));
        expected.put(Range.closed(5., 10.), new SpeedLimits(42, ImmutableMap.of(
                "category1", 10.,
                "category2", 12.,
                "category3", 17.
        )));
        expected.put(Range.closed(10., 15.), new SpeedLimits(45, ImmutableMap.of(
                "category2", 12.,
                "category3", 17.
        )));
        var speedLimits = parsedInfra.getTrackSection(track.id).getSpeedSections().get(Direction.FORWARD);
        equalsIgnoringTransitions(expected, speedLimits);
    }
}
