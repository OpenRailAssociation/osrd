package fr.sncf.osrd.train;

import static fr.sncf.osrd.Helpers.*;
import static fr.sncf.osrd.train.TestTrains.FAST_NO_FRICTION_TRAIN;
import static org.junit.jupiter.api.Assertions.*;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.*;
import fr.sncf.osrd.infra.routegraph.RouteGraph;
import fr.sncf.osrd.infra.trackgraph.BufferStop;
import fr.sncf.osrd.infra.trackgraph.TrackGraph;
import fr.sncf.osrd.infra.trackgraph.Waypoint;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidSchedule;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.simulation.SimulationError;
import fr.sncf.osrd.simulation.changelog.ArrayChangeLog;
import fr.sncf.osrd.speedcontroller.SpeedInstructions;
import fr.sncf.osrd.train.events.TrainCreatedEvent;
import fr.sncf.osrd.train.phases.NavigatePhase;
import fr.sncf.osrd.train.phases.SignalNavigatePhase;
import fr.sncf.osrd.utils.RangeValue;
import fr.sncf.osrd.utils.SignAnalyzer;
import fr.sncf.osrd.utils.SortedArraySet;
import fr.sncf.osrd.utils.TrackSectionLocation;
import fr.sncf.osrd.utils.graph.EdgeDirection;
import org.junit.jupiter.api.Test;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.stream.Collectors;


public class StaticSpeedLimitTest {
    // kept for debugging
    @SuppressFBWarnings({"URF_UNREAD_FIELD"})
    static class ProfileData {
        final SignAnalyzer.SignProfile profile;
        final int index;
        final double position;

        ProfileData(SignAnalyzer.SignProfile profile, int index, double position) {
            this.profile = profile;
            this.index = index;
            this.position = position;
        }
    }

    @Test
    public void simpleSpeedLimitTest() throws InvalidInfraException, SimulationError, InvalidSchedule {
        var trackGraph = new TrackGraph();

        var nodeA = trackGraph.makePlaceholderNode("A");
        var nodeB = trackGraph.makePlaceholderNode("B");
        var edgeLength = 10000.0;
        var edge = trackGraph.makeTrackSection(nodeA.index, nodeB.index, "e1", edgeLength, null);
        var waypointsBuilder = edge.waypoints.builder();
        var bufferStopA = new BufferStop(0, "BufferStopA");
        waypointsBuilder.add(0, bufferStopA);
        var bufferStopB = new BufferStop(1, "BufferStopB");
        waypointsBuilder.add(10000, bufferStopB);
        waypointsBuilder.build();

        // create operational points for the trip
        var opStart = new OperationalPoint("start id");
        var opEnd = new OperationalPoint("end id");

        var opBuilder = edge.operationalPoints.builder();
        opStart.addRef(edge, 0, opBuilder);
        opEnd.addRef(edge, edgeLength, opBuilder);
        opBuilder.build();

        // add the speed limits
        var limits = edge.forwardSpeedSections;
        limits.add(new RangeValue<>(0, 10000, new SpeedSection(false, 30.0)));
        limits.add(new RangeValue<>(5000, 6000, new SpeedSection(false, 25.0)));

        final var tvdSections = new HashMap<String, TVDSection>();

        var tvdSection = makeTVDSection(bufferStopA, bufferStopB);
        tvdSection.index = 0;
        assignAfterTVDSection(tvdSection, bufferStopA);
        assignBeforeTVDSection(tvdSection, bufferStopB);
        tvdSections.put(tvdSection.id, tvdSection);

        final var routeGraphBuilder = new RouteGraph.Builder(trackGraph, 2);

        var tvdSectionsR1 = new SortedArraySet<TVDSection>();
        tvdSectionsR1.add(tvdSection);
        var releaseGroups = new ArrayList<SortedArraySet<TVDSection>>();
        var releaseGroup = new SortedArraySet<TVDSection>();
        releaseGroup.add(tvdSection);
        releaseGroups.add(releaseGroup);
        var route = routeGraphBuilder.makeRoute("R1", tvdSectionsR1, releaseGroups,
                new HashMap<>(), bufferStopA, bufferStopB, null, EdgeDirection.START_TO_STOP);

        final var infra = Infra.build(trackGraph, routeGraphBuilder.build(),
                tvdSections, new HashMap<>(), new ArrayList<>(), new ArrayList<>());

        // initialize the simulation
        var changelog = new ArrayChangeLog();
        var sim = Simulation.createFromInfraAndEmptySuccessions(infra, 0, changelog);

        var startLocation = new TrackSectionLocation(edge, 0);
        var path = new TrainPath(Collections.singletonList(route),
                startLocation,
                new TrackSectionLocation(edge, 10000));
        var phases = new ArrayList<NavigatePhase>();
        var stops = Collections.singletonList(new TrainStop(path.length, 1));
        phases.add(SignalNavigatePhase.from(
                400,
                startLocation,
                new TrackSectionLocation(edge, 10000), path, stops));

        var schedule = new TrainSchedule(
                "test_train",
                FAST_NO_FRICTION_TRAIN,
                0,
                startLocation,
                EdgeDirection.START_TO_STOP,
                route,
                0,
                phases,
                null,
                path,
                new SpeedInstructions(null),
                stops);
        TrainCreatedEvent.plan(sim, schedule);

        // run the simulation
        while (!sim.isSimulationOver())
            sim.step();

        // get location changes
        var locationChanges = changelog.publishedChanges.stream()
                .filter(change -> change.getClass() == Train.TrainStateChange.class)
                .map(change -> (Train.TrainStateChange) change)
                .collect(Collectors.toList());

        // Flatten the updates to get one list with the movements of the train
        var speedUpdates = new ArrayList<Train.TrainStateChange.SpeedUpdate>();
        for (var locationChange : locationChanges)
            speedUpdates.addAll(locationChange.positionUpdates);

        // create the list of all speed derivative sign changes
        var profile = new ArrayList<ProfileData>();
        var profiler = new SignAnalyzer();
        var position = 0.0;
        for (int i = 0; i < speedUpdates.size(); i++) {
            var posUpdate = speedUpdates.get(i);
            var profileChange = profiler.feed(posUpdate.speed);
            if (profileChange != null)
                profile.add(new ProfileData(profileChange, i, position));
            position = posUpdate.pathPosition;
        }

        assertTrue(position <= edgeLength + 30.0);

        // speed limit
        //    +-------------------------------+        +----------------------+
        //                                    |        |
        //                                    +--------+
        // profile
        //     _______________________________          _______________________
        //    /                               \________/
        //  INCR          CONST             DECR CONST INCR       CONST
        //
        // the constant sign parts can't quite be detected by the analyzer, as the samples are deduped
        var expectedProfileChanges = new SignAnalyzer.SignProfile[] {
                SignAnalyzer.SignProfile.INCREASING,
                // SignAnalyzer.SignProfile.CONSTANT,
                SignAnalyzer.SignProfile.DECREASING,
                // SignAnalyzer.SignProfile.CONSTANT,
                SignAnalyzer.SignProfile.INCREASING,
                // SignAnalyzer.SignProfile.CONSTANT
                SignAnalyzer.SignProfile.DECREASING,
        };

        assertArrayEquals(expectedProfileChanges, profile.stream().map(p -> p.profile).toArray());
    }
}
