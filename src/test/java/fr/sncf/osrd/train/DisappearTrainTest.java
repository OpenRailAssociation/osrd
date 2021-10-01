package fr.sncf.osrd.train;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.*;
import fr.sncf.osrd.infra.routegraph.RouteGraph;
import fr.sncf.osrd.infra.trackgraph.BufferStop;
import fr.sncf.osrd.infra.trackgraph.TrackGraph;
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
import java.util.Collections;
import java.util.HashMap;
import java.util.stream.Collectors;

import static fr.sncf.osrd.Helpers.*;
import static fr.sncf.osrd.train.TestTrains.FAST_NO_FRICTION_TRAIN;
import static org.junit.jupiter.api.Assertions.*;


public class DisappearTrainTest {

    @Test
    public void finalRouteLiberationTest() throws InvalidInfraException, SimulationError, InvalidSchedule {
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
        var stops = Collections.singletonList(new TrainStop(path.length, 0));
        phases.add(SignalNavigatePhase.from(
                400,
                startLocation,
                new TrackSectionLocation(edge, 10000), path, stops));

        var schedule1 = new TrainSchedule(
                "train1",
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
        TrainCreatedEvent.plan(sim, schedule1);

        var schedule2 = new TrainSchedule(
                "train2",
                FAST_NO_FRICTION_TRAIN,
                1200,
                startLocation,
                EdgeDirection.START_TO_STOP,
                route,
                0,
                phases,
                null,
                path,
                new SpeedInstructions(null),
                stops);
        TrainCreatedEvent.plan(sim, schedule2);

        // run the simulation
        while (!sim.isSimulationOver())
            sim.step();

        var lastPosition1 = sim.trains.get("train1").getLastState().location.getPathPosition();
        var lastPosition2 = sim.trains.get("train2").getLastState().location.getPathPosition();

        assertEquals(lastPosition1, lastPosition2, 10);

        assert(sim.trains.get("train1").getLastState().status.equals(TrainStatus.REACHED_DESTINATION));
        assert(sim.trains.get("train2").getLastState().status.equals(TrainStatus.REACHED_DESTINATION));
    }
}
