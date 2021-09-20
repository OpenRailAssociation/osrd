package fr.sncf.osrd.train;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.*;
import fr.sncf.osrd.infra.routegraph.RouteGraph;
import fr.sncf.osrd.infra.trackgraph.BufferStop;
import fr.sncf.osrd.infra.trackgraph.TrackGraph;
import fr.sncf.osrd.railjson.parser.RailJSONParser;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidSchedule;
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSSlope;
import fr.sncf.osrd.railjson.schema.schedule.RJSAllowance;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.simulation.SimulationError;
import fr.sncf.osrd.simulation.changelog.ArrayChangeLog;
import fr.sncf.osrd.speedcontroller.SpeedInstructions;
import fr.sncf.osrd.speedcontroller.generators.ConstructionAllowanceGenerator;
import fr.sncf.osrd.speedcontroller.generators.LinearAllowanceGenerator;
import fr.sncf.osrd.speedcontroller.generators.MarecoAllowanceGenerator;
import fr.sncf.osrd.speedcontroller.generators.SpeedControllerGenerator;
import fr.sncf.osrd.train.events.TrainCreatedEvent;
import fr.sncf.osrd.train.phases.NavigatePhase;
import fr.sncf.osrd.train.phases.SignalNavigatePhase;
import fr.sncf.osrd.utils.RangeValue;
import fr.sncf.osrd.utils.SignAnalyzer;
import fr.sncf.osrd.utils.SortedArraySet;
import fr.sncf.osrd.utils.TrackSectionLocation;
import fr.sncf.osrd.utils.graph.EdgeDirection;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.stream.Collectors;

import static fr.sncf.osrd.Helpers.*;
import static fr.sncf.osrd.railjson.schema.schedule.RJSAllowance.LinearAllowance.MarginType.TIME;
import static fr.sncf.osrd.train.TestTrains.REALISTIC_FAST_TRAIN_MAX_DEC_TYPE;
import static java.lang.Double.POSITIVE_INFINITY;
import static org.junit.jupiter.api.Assertions.*;
import static org.junit.jupiter.api.Assertions.assertEquals;

public class NonConstantDecTest {
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
        var stops = Collections.singletonList(new TrainStop(path.length, 0));
        phases.add(SignalNavigatePhase.from(
                400,
                startLocation,
                new TrackSectionLocation(edge, 10000), path, stops));

        var schedule = new TrainSchedule(
                "test_train",
                REALISTIC_FAST_TRAIN_MAX_DEC_TYPE,
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


    /** Test the construction margin */
    @ParameterizedTest
    @ValueSource(doubles = {0.0, 30, 100})
    public void testConstructionMargins(double value) throws InvalidInfraException {
        final var infra = getBaseInfra();
        assert infra != null;
        var params = new ConstructionAllowanceGenerator(0, POSITIVE_INFINITY, value);

        // base run, no margin
        final var config = getBaseConfigNoAllowanceNonConstantDec();
        var sim = Simulation.createFromInfraAndEmptySuccessions(RailJSONParser.parse(infra), 0, null);
        var eventsBase = run(sim, config);
        var baseSimTime = sim.getTime();

        // Run with construction margin
        final var configMargins = getConfigWithSpeedInstructionsNonConstantDec(
                SpeedInstructions.fromController(params));
        var sim2 = Simulation.createFromInfraAndEmptySuccessions(RailJSONParser.parse(infra), 0, null);
        var events = run(sim2, configMargins);
        var marginsSimTime = sim2.getTime();

        var expected = baseSimTime + params.value;

        assertEquals(expected, marginsSimTime, expected * 0.01);
        saveGraph(eventsBase, "..\\construction-base-nonconstdec.csv");
        saveGraph(events, "..\\construction-nonconstdec-out.csv");
    }


    /** Test the construction margin on a small segment */
    @ParameterizedTest
    @ValueSource(doubles = {0.0, 30, 100})
    public void testConstructionMarginsOnSegment(double value) throws InvalidInfraException {
        final var infra = getBaseInfra();
        assert infra != null;
        double begin = 4000;
        double end = 5000;
        double tolerance = 0.01; //percentage
        var params = new ConstructionAllowanceGenerator(begin, end, value);

        // base run, no margin
        final var config = getBaseConfigNoAllowanceNonConstantDec();
        var sim = Simulation.createFromInfraAndEmptySuccessions(RailJSONParser.parse(infra), 0, null);
        var eventsBase = run(sim, config);

        // Run with construction margin
        final var configMargins = getConfigWithSpeedInstructionsNonConstantDec(
                SpeedInstructions.fromController(params));
        var sim2 = Simulation.createFromInfraAndEmptySuccessions(RailJSONParser.parse(infra), 0, null);
        var events = run(sim2, configMargins);

        var timesBase = getTimePerPosition(eventsBase);
        var timeFirstPointBase = timesBase.interpolate(begin);
        var timeSecondPointBase = timesBase.interpolate(end);

        var times = getTimePerPosition(events);
        var timeFirstPoint = times.interpolate(begin);
        var timeSecondPoint = times.interpolate(end);
        var expectedTimeSecondPoint = timeSecondPointBase + params.value;

        // make sure begin has the same time before and after margin, and that end is offset by the proper value
        assertEquals(timeFirstPointBase, timeFirstPoint, timeFirstPointBase * tolerance);
        assertEquals(expectedTimeSecondPoint, timeSecondPoint, expectedTimeSecondPoint * tolerance);

        var speedsBase = getSpeedPerPosition(eventsBase);
        var speedFirstPointBase = speedsBase.interpolate(begin);
        var speedSecondPointBase = speedsBase.interpolate(end);

        var speeds = getSpeedPerPosition(events);
        var speedFirstPoint = speeds.interpolate(begin);
        var speedSecondPoint = speeds.interpolate(end);

        // make sure begin and end have the same speed before and after margin
        assertEquals(speedFirstPointBase, speedFirstPoint, speedFirstPointBase * tolerance);
        assertEquals(speedSecondPointBase, speedSecondPoint, speedSecondPointBase * tolerance);

        var baseSimTime = sim.getTime();
        var marginsSimTime = sim2.getTime();

        var expectedTotalTime = baseSimTime + params.value;

        saveGraph(eventsBase, "..\\construction-segment-base-nonconstdec.csv");
        saveGraph(events, "..\\construction-segment-nonconstdec-out.csv");

        assertEquals(expectedTotalTime, marginsSimTime, expectedTotalTime * tolerance);
    }

    @Test
    public void testConstructionOnLinearMargin() throws InvalidInfraException {
        final var infra = getBaseInfra();
        assert infra != null;
        var params1 = new LinearAllowanceGenerator(0, POSITIVE_INFINITY,
                10, TIME);
        var params2 = new ConstructionAllowanceGenerator(0, POSITIVE_INFINITY, 15);

        var params = new ArrayList<SpeedControllerGenerator>();
        params.add(params1);
        params.add(params2);

        // Run with construction margin
        final var configMargins = getConfigWithSpeedInstructionsNonConstantDec(SpeedInstructions.fromList(params));
        var sim2 = Simulation.createFromInfraAndEmptySuccessions(RailJSONParser.parse(infra), 0, null);
        var events = run(sim2, configMargins);
        var marginsSimTime = sim2.getTime();

        // base run, no margin
        final var config = getBaseConfigNoAllowanceNonConstantDec();
        var sim = Simulation.createFromInfraAndEmptySuccessions(RailJSONParser.parse(infra), 0, null);
        var eventsBase = run(sim, config);
        var baseSimTime = sim.getTime();

        var expected = baseSimTime * (1 + params1.value / 100) + params2.value;

        assertEquals(expected, marginsSimTime, expected * 0.01);

        saveGraph(eventsBase, "..\\linear-time-on-construction-base-nonconstdec.csv");
        saveGraph(events, "..\\linear-time-on-construction-nonconstdec-out.csv");
    }

    @Test
    public void testMarecoOnConstructionMargin() throws InvalidInfraException {
        final var infra = getBaseInfra();
        assert infra != null;
        var params1 = new ConstructionAllowanceGenerator(3000, 5000, 30);
        var params2 = new MarecoAllowanceGenerator(0, POSITIVE_INFINITY,
                10, RJSAllowance.MarecoAllowance.MarginType.TIME);

        var params = new ArrayList<SpeedControllerGenerator>();
        params.add(params1);
        params.add(params2);

        // Run with construction margin
        final var configMargins = getConfigWithSpeedInstructionsNonConstantDec(SpeedInstructions.fromList(params));
        var sim2 = Simulation.createFromInfraAndEmptySuccessions(RailJSONParser.parse(infra), 0, null);
        var events = run(sim2, configMargins);
        var marginsSimTime = sim2.getTime();

        // base run, no margin
        final var config = getBaseConfigNoAllowanceNonConstantDec();
        var sim = Simulation.createFromInfraAndEmptySuccessions(RailJSONParser.parse(infra), 0, null);
        var eventsBase = run(sim, config);
        var baseSimTime = sim.getTime();

        var expected = (baseSimTime + params1.value) * (1 + params2.value / 100);

        assertEquals(expected, marginsSimTime, expected * 0.01);

        saveGraph(eventsBase, "..\\mareco-on-construction-base-nonconstdec.csv");
        saveGraph(events, "..\\mareco-on-construction-nonconstdec-out.csv");
    }

    /** Test mareco */
    @ParameterizedTest
    @ValueSource(doubles = {0.0, 10, 30, 200})
    //@ValueSource(doubles = {127})
    public void testEcoMargin(double value) throws InvalidInfraException {
        final var infra = getBaseInfra();
        assert infra != null;
        var params = new MarecoAllowanceGenerator(0, POSITIVE_INFINITY,
                value, RJSAllowance.MarecoAllowance.MarginType.TIME);

        // Run with construction margin
        final var configMargins = getConfigWithSpeedInstructionsNonConstantDec(
                SpeedInstructions.fromController(params));
        var sim2 = Simulation.createFromInfraAndEmptySuccessions(RailJSONParser.parse(infra), 0, null);
        var events = run(sim2, configMargins);
        var marginsSimTime = sim2.getTime();

        // base run, no margin
        final var config = getBaseConfigNoAllowanceNonConstantDec();
        var sim = Simulation.createFromInfraAndEmptySuccessions(RailJSONParser.parse(infra), 0, null);
        var eventsBase = run(sim, config);
        var baseSimTime = sim.getTime();

        saveGraph(eventsBase, "..\\mareco-base-nonconstdec.csv");
        saveGraph(events, "..\\mareco-nonconstdec-out.csv");

        var expected = baseSimTime * (1 + params.value / 100);
        assertEquals(expected, marginsSimTime, 5);
    }

    /** Test mareco with different slopes*/
    @ParameterizedTest
    @ValueSource(ints = {0, 1, 2, 3, 4, 5, 6, 7})
    public void testDifferentSlopes(int slopeProfile) throws InvalidInfraException {
        // inputs
        final double margin = 40.0;
        var slopes = new ArrayList<RJSSlope>();
        switch (slopeProfile) {
            case 0: // no slope / ramp
                slopes.add(new RJSSlope(0, 10000, 0));
                break;
            case 1: // ramp
                slopes.add(new RJSSlope(0, 10000, 10));
                break;
            case 2: // low slope
                slopes.add(new RJSSlope(0, 10000, -2));
                break;
            case 3: // high slope
                slopes.add(new RJSSlope(0, 10000, -10));
                break;
            case 4: // high slope on a short segment
                slopes.add(new RJSSlope(0, 5000, 0));
                slopes.add(new RJSSlope(5000, 6000, -10));
                slopes.add(new RJSSlope(6000, 10000, 0));
                break;
            case 5: // high slope on half
                slopes.add(new RJSSlope(0, 5000, 0));
                slopes.add(new RJSSlope(5000, 10000, -10));
                break;
            case 6: // high slope on acceleration
                slopes.add(new RJSSlope(0, 1000, -10));
                slopes.add(new RJSSlope(1000, 10000, 0));
                break;
            case 7: // plenty of different slopes
                slopes.add(new RJSSlope(0, 3000, 0));
                slopes.add(new RJSSlope(3000, 3100, -20));
                slopes.add(new RJSSlope(3100, 3200, 10));
                slopes.add(new RJSSlope(3200, 3500, -15));
                slopes.add(new RJSSlope(3500, 4000, 5));
                slopes.add(new RJSSlope(4000, 5000, -2));
                slopes.add(new RJSSlope(5000, 7000, 0));
                slopes.add(new RJSSlope(7000, 7500, -10));
                slopes.add(new RJSSlope(7500, 10000, 10));
                break;
            default:
                throw new InvalidInfraException("Unable to handle this parameter in testDifferentSlopes");
        }

        // build sims
        var rjsInfra = getBaseInfra();
        assert rjsInfra != null;
        for (var trackSection : rjsInfra.trackSections)
            if ("ne.micro.foo_to_bar".equals(trackSection.id))
                trackSection.slopes = slopes;

        var infra = RailJSONParser.parse(rjsInfra);

        // Run with mareco
        var marginsConfig = getConfigWithSpeedInstructionsAndInfraNonConstDec(
                SpeedInstructions.fromController(
                        new MarecoAllowanceGenerator(
                                0,
                                POSITIVE_INFINITY,
                                margin,
                                RJSAllowance.MarecoAllowance.MarginType.TIME
                        )
                ),
                infra
        );
        var marginsSim = Simulation.createFromInfraAndEmptySuccessions(infra, 0, null);
        var events = run(marginsSim, marginsConfig);
        var marginsSimTime = marginsSim.getTime();

        // base run, no margin
        final var config = getBaseConfigNoAllowanceNonConstantDec();
        var sim = Simulation.createFromInfraAndEmptySuccessions(infra, 0, null);
        var eventsBase = run(sim, config);
        var simTime = sim.getTime();

        saveGraph(eventsBase, "..\\mareco-slope-base-nonconstdec.csv");
        saveGraph(events, "..\\mareco-slope-nonconstdec-out.csv");

        var expected = simTime * (1 + margin / 100);
        assertEquals(expected, marginsSimTime, 5 + 0.001 * expected);

        var coastingSpeedControllers =
                findCoastingSpeedControllers(
                        marginsConfig.trainSchedules.get(0).speedInstructions.targetSpeedControllers
                );
        for (var controller : coastingSpeedControllers) {
            assertLowerSpeedPerPositionBetween(eventsBase, events, controller.beginPosition, controller.endPosition);
        }
    }

    @Test
    public void testSeveralConstructionMargins() throws InvalidInfraException {
        final var infra = getBaseInfra();
        var param1 = new ConstructionAllowanceGenerator(0, 5000, 15);
        var param2 = new ConstructionAllowanceGenerator(5000, POSITIVE_INFINITY, 30);

        final var config = getConfigWithSpeedInstructionsNonConstantDec(
                SpeedInstructions.fromList(Arrays.asList(param1, param2)));
        var sim = Simulation.createFromInfraAndEmptySuccessions(RailJSONParser.parse(infra), 0, null);
        saveGraph(run(sim, config), "double-construction-nonconstdec-out.csv");
        var actualEndTime = sim.getTime();

        final var configBase = getBaseConfigNoAllowanceNonConstantDec();
        var simBase = Simulation.createFromInfraAndEmptySuccessions(RailJSONParser.parse(infra), 0, null);
        saveGraph(run(simBase, configBase), "double-construction-base-nonconstdec.csv");
        var baseEndTime = simBase.getTime();

        var expected = baseEndTime + param1.value + param2.value;

        assertEquals(expected, actualEndTime, expected * 0.01);
    }

}
