package fr.sncf.osrd.infra_state;

import static fr.sncf.osrd.Helpers.infraFromRJS;
import static fr.sncf.osrd.infra.InfraHelpers.*;
import static fr.sncf.osrd.infra.api.Direction.BACKWARD;
import static fr.sncf.osrd.infra.api.Direction.FORWARD;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.google.common.collect.Range;
import com.google.common.collect.RangeMap;
import com.google.common.collect.TreeRangeMap;
import fr.sncf.osrd.envelope_sim_infra.EnvelopeTrainPath;
import fr.sncf.osrd.infra.api.Direction;
import fr.sncf.osrd.infra.api.tracks.undirected.TrackLocation;
import fr.sncf.osrd.infra_state.api.TrainPath;
import fr.sncf.osrd.infra_state.implementation.TrainPathBuilder;
import fr.sncf.osrd.infra_state.implementation.errors.InvalidPathError;
import fr.sncf.osrd.railjson.schema.common.graph.EdgeDirection;
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainPath;
import org.junit.jupiter.api.Test;
import java.util.EnumMap;
import java.util.List;

public class TrainPathTests {

    @Test
    public void testFromRJSTrainPath() {
        var rjsInfra = makeSingleTrackRJSInfra();
        var infra = infraFromRJS(rjsInfra);
        var rjsPath = new RJSTrainPath(List.of(
                new RJSTrainPath.RJSRoutePath("route_forward", List.of(
                        new RJSTrainPath.RJSDirectionalTrackRange("track", 20, 80, EdgeDirection.START_TO_STOP)
                ), "BAL3")
        ));
        var path = TrainPathBuilder.from(infra, rjsPath);
        assertEquals(60, path.length());
    }

    @Test
    public void testSingleTrackInfraSimple() {
        var rjsInfra = makeSingleTrackRJSInfra();
        var infra = infraFromRJS(rjsInfra);
        var track = infra.getTrackSection("track");
        var path = TrainPathBuilder.from(
                List.of(getSignalingRoute(infra, "route_forward")),
                new TrackLocation(track, 0),
                new TrackLocation(track, 100)
        );

        assertEquals(100, path.length());

        assertEquals(1, path.routePath().size());
        assertEquals(0, path.routePath().get(0).pathOffset());
        assertEquals("route_forward", path.routePath().get(0).element().getInfraRoute().getID());

        assertEquals(4, path.detectors().size());
        assertEquals(0, path.detectors().get(0).pathOffset());
        assertEquals(50, path.detectors().get(1).pathOffset());
        assertEquals(75, path.detectors().get(2).pathOffset());
        assertEquals(100, path.detectors().get(3).pathOffset());
        assertEquals("bs_start", path.detectors().get(0).element().detector().getID());
        assertEquals("d1", path.detectors().get(1).element().detector().getID());
        assertEquals("d2", path.detectors().get(2).element().detector().getID());
        assertEquals("bs_end", path.detectors().get(3).element().detector().getID());
        for (var d : path.detectors())
            assertEquals(FORWARD, d.element().direction());

        assertEquals(3, path.detectionSections().size());
        for (int i = 0; i < 3; i++)
            assertEquals(
                    path.detectors().get(i).element().detector().getNextDetectionSection(FORWARD),
                    path.detectionSections().get(i).element()
            );

        assertEquals(1, path.trackRangePath().size());
        assertEquals(0, path.trackRangePath().get(0).element().begin);
        assertEquals(100, path.trackRangePath().get(0).element().end);
    }

    @Test
    public void testSingleTrackInfraTwoRoutes() {
        var rjsInfra = makeSingleTrackRJSInfra();
        var infra = infraFromRJS(rjsInfra);
        var track = infra.getTrackSection("track");
        var path = TrainPathBuilder.from(
                List.of(
                        getSignalingRoute(infra, "route_forward_first_half"),
                        getSignalingRoute(infra, "route_forward_second_half")
                ),
                new TrackLocation(track, 20),
                new TrackLocation(track, 80)
        );

        assertEquals(60, path.length());

        assertEquals(2, path.routePath().size());
        assertEquals(-20, path.routePath().get(0).pathOffset());
        assertEquals(30, path.routePath().get(1).pathOffset());
        assertEquals("route_forward_first_half", path.routePath().get(0).element().getInfraRoute().getID());
        assertEquals("route_forward_second_half", path.routePath().get(1).element().getInfraRoute().getID());

        assertEquals(2, path.detectors().size());
        assertEquals(50 - 20, path.detectors().get(0).pathOffset());
        assertEquals(75 - 20, path.detectors().get(1).pathOffset());
        assertEquals("d1", path.detectors().get(0).element().detector().getID());
        assertEquals("d2", path.detectors().get(1).element().detector().getID());
        for (var d : path.detectors())
            assertEquals(FORWARD, d.element().direction());

        assertEquals(3, path.detectionSections().size());

        assertEquals(2, path.trackRangePath().size());
        assertEquals(20, path.trackRangePath().get(0).element().begin);
        assertEquals(50, path.trackRangePath().get(0).element().end);
        assertEquals(50, path.trackRangePath().get(1).element().begin);
        assertEquals(80, path.trackRangePath().get(1).element().end);
        assertEquals(30, path.trackRangePath().get(1).pathOffset());
    }

    @Test
    public void testSingleTrackInfraBackward() {
        var rjsInfra = makeSingleTrackRJSInfra();
        var infra = infraFromRJS(rjsInfra);
        var track = infra.getTrackSection("track");
        var path = TrainPathBuilder.from(
                List.of(getSignalingRoute(infra, "route_backward")),
                new TrackLocation(track, 90),
                new TrackLocation(track, 10)
        );

        assertEquals(80, path.length());

        assertEquals(1, path.routePath().size());
        assertEquals(-10, path.routePath().get(0).pathOffset());
        assertEquals("route_backward", path.routePath().get(0).element().getInfraRoute().getID());

        assertEquals(2, path.detectors().size());
        assertEquals(90 - 75, path.detectors().get(0).pathOffset());
        assertEquals(90 - 50, path.detectors().get(1).pathOffset());
        assertEquals("d2", path.detectors().get(0).element().detector().getID());
        assertEquals("d1", path.detectors().get(1).element().detector().getID());
        for (var d : path.detectors())
            assertEquals(BACKWARD, d.element().direction());

        assertEquals(3, path.detectionSections().size());

        assertEquals(1, path.trackRangePath().size());
        assertEquals(10, path.trackRangePath().get(0).element().begin);
        assertEquals(90, path.trackRangePath().get(0).element().end);
    }

    @Test
    public void envelopeTrainPathTests() {
        var gradients = new EnumMap<Direction, RangeMap<Double, Double>>(Direction.class);
        var map = TreeRangeMap.<Double, Double>create();
        map.put(Range.closed(0., 100.), 0.);
        map.put(Range.closed(0., 30.), 30.);
        map.put(Range.closed(60., 80.), -10.);
        for (var dir : Direction.values())
            gradients.put(dir, map);
        var rjsInfra = makeSingleTrackRJSInfra();
        var infra = infraFromRJS(rjsInfra);
        var track = infra.getTrackSection("track");
        setGradient(track, gradients);
        var path = TrainPathBuilder.from(
                List.of(getSignalingRoute(infra, "route_forward")),
                new TrackLocation(track, 10),
                new TrackLocation(track, 100)
        );
        var envelopePath = EnvelopeTrainPath.from(TrainPath.removeLocation(path.trackRangePath()));
        assertEquals(30, envelopePath.getAverageGrade(0, 20));
        assertEquals(0, envelopePath.getAverageGrade(20, 50));
        assertEquals(-10, envelopePath.getAverageGrade(50, 70));
        assertEquals(0, envelopePath.getAverageGrade(70, 80));
    }

    @Test
    public void duplicateRouteTest() {
        var rjsInfra = makeSingleTrackRJSInfra();
        var infra = infraFromRJS(rjsInfra);
        var track = infra.getTrackSection("track");
        var route = getSignalingRoute(infra, "route_forward");
        assertThrows(InvalidPathError.class,
                () -> TrainPathBuilder.from(
                        List.of(route, route),
                        new TrackLocation(track, 0),
                        new TrackLocation(track, 100)
                )
        );
    }
}
