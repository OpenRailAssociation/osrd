package fr.sncf.osrd.speedcontroller;

import static fr.sncf.osrd.Helpers.*;
import static fr.sncf.osrd.railjson.schema.schedule.RJSAllowance.LinearAllowance.MarginType.TIME;
import static org.junit.jupiter.api.Assertions.assertEquals;

import fr.sncf.osrd.TestConfig;
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSSlope;
import fr.sncf.osrd.railjson.schema.schedule.RJSAllowance.ConstructionAllowance;
import fr.sncf.osrd.railjson.schema.schedule.RJSAllowance.LinearAllowance;
import fr.sncf.osrd.railjson.schema.schedule.RJSAllowance.MarecoAllowance;
import fr.sncf.osrd.simulation.TimelineEvent;
import fr.sncf.osrd.train.TrainSchedule;
import fr.sncf.osrd.railjson.schema.schedule.RJSAllowance;
import fr.sncf.osrd.utils.TrackSectionLocation;

import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.ArrayList;


public class MarginTests {
    public static class ComparativeTest {
        public final TestConfig.TestSimulationState baseState;
        public final ArrayList<TimelineEvent> baseEvents;
        public final TestConfig.TestSimulationState testedState;
        public final ArrayList<TimelineEvent> testedEvents;

        private ComparativeTest(
                TestConfig.TestSimulationState baseState,
                ArrayList<TimelineEvent> baseEvents,
                TestConfig.TestSimulationState testedState,
                ArrayList<TimelineEvent> testedEvents
        ) {
            this.baseState = baseState;
            this.baseEvents = baseEvents;
            this.testedState = testedState;
            this.testedEvents = testedEvents;
        }

        /** Run a comparative test from a configuration, and a function which modifies it slightly */
        public static ComparativeTest from(TestConfig config, Runnable modifier) {
            var basePrepared = config.prepare();
            var baseEvents = basePrepared.run();

            modifier.run();

            var newPrepared = config.prepare();
            var newEvents = newPrepared.run();
            return new ComparativeTest(basePrepared, baseEvents, newPrepared, newEvents);
        }

        /** Save the event logs are CSV using the name of the test */
        public void saveGraphs(TestInfo testInfo) {
            var testName = testInfo.getTestMethod().orElseThrow().getName();

            saveGraph(baseEvents, "..\\" + testName + "-base.csv");
            saveGraph(testedEvents, "..\\" + testName + "-tested.csv");
        }

        public double baseTime() {
            return baseState.sim.getTime();
        }

        public double testedTime() {
            return testedState.sim.getTime();
        }
    }

    public static final String CONFIG_PATH = "tiny_infra/config_railjson.json";

    /** Test the linear allowance */
    @ParameterizedTest
    @ValueSource(doubles = {149.9999, 150})
    public void testLinearAllowance(double value, TestInfo info) {
        var config = TestConfig.readResource(CONFIG_PATH).clearAllowances();

        var allowance = new LinearAllowance(TIME, value);
        var test = ComparativeTest.from(config, () -> config.setAllAllowances(allowance));

        test.saveGraphs(info);
        var expected = test.baseTime() * (1 + value / 100);
        assertEquals(expected, test.testedTime(), expected * 0.01);
    }

    /** Test the construction margin */
    public static void testConstructionMargins(String configPath, double value, TestInfo info) {
        var allowance = new ConstructionAllowance(value);

        var config = TestConfig.readResource(configPath).clearAllowances();
        var test = ComparativeTest.from(config, () -> config.setAllAllowances(allowance));

        test.saveGraphs(info);
        var expected = test.baseTime() + value;
        assertEquals(expected, test.testedTime(), expected * 0.01);
    }

    @ParameterizedTest
    @ValueSource(doubles = {0.0, 30, 100})
    public void testConstructionMargins(double value, TestInfo info) {
        testConstructionMargins(CONFIG_PATH, value, info);
    }

    /** Test the construction margin on a small segment */
    public static void testConstructionMarginsOnSegment(String configPath, double value, TestInfo info) {
        final double begin = 4000;
        final double end = 5000;
        final double tolerance = 0.01; // percentage

        var allowance = new ConstructionAllowance(value);
        allowance.beginPosition = begin;
        allowance.endPosition = end;

        var config = TestConfig.readResource(configPath).clearAllowances();
        var test = ComparativeTest.from(config, () -> config.setAllAllowances(allowance));
        test.saveGraphs(info);

        var timesBase = getTimePerPosition(test.baseEvents);
        var timeFirstPointBase = timesBase.interpolate(begin);
        var timeSecondPointBase = timesBase.interpolate(end);

        var times = getTimePerPosition(test.testedEvents);
        var timeFirstPoint = times.interpolate(begin);
        var timeSecondPoint = times.interpolate(end);
        var expectedTimeSecondPoint = timeSecondPointBase + value;

        // make sure begin has the same time before and after margin, and that end is offset by the proper value
        assertEquals(timeFirstPointBase, timeFirstPoint, timeFirstPointBase * tolerance);
        assertEquals(expectedTimeSecondPoint, timeSecondPoint, expectedTimeSecondPoint * tolerance);

        var speedsBase = getSpeedPerPosition(test.baseEvents);
        var speedFirstPointBase = speedsBase.interpolate(begin);
        var speedSecondPointBase = speedsBase.interpolate(end);

        var speeds = getSpeedPerPosition(test.testedEvents);
        var speedFirstPoint = speeds.interpolate(begin);
        var speedSecondPoint = speeds.interpolate(end);

        // make sure begin and end have the same speed before and after margin
        assertEquals(speedFirstPointBase, speedFirstPoint, speedFirstPointBase * tolerance);
        assertEquals(speedSecondPointBase, speedSecondPoint, speedSecondPointBase * tolerance);

        var expectedTotalTime = test.baseTime() + value;

        assertEquals(expectedTotalTime, test.testedTime(), expectedTotalTime * tolerance);
    }

    @ParameterizedTest
    @ValueSource(doubles = {0.0, 30, 100})
    public void testConstructionMarginsOnSegment(double value, TestInfo info) {
        testConstructionMarginsOnSegment(CONFIG_PATH, value, info);
    }

    /** Tests stacking construction and linear margins */
    public static void testConstructionOnLinearMargin(String configPath, TestInfo info) {
        // setup allowances
        var linearAllowance = new LinearAllowance(TIME, 10);
        var constructionAllowance = new ConstructionAllowance(15);
        var allowances = new RJSAllowance[][] {
                { linearAllowance },
                { constructionAllowance },
        };

        // run the baseline and testing simulation
        var testConfig = TestConfig.readResource(configPath).clearAllowances();
        var test = ComparativeTest.from(testConfig, () -> testConfig.setAllAllowances(allowances));
        test.saveGraphs(info);

        // check the results
        var expectedTime = (
                test.baseTime() * (1. + linearAllowance.allowanceValue / 100.)
                        + constructionAllowance.allowanceValue
        );
        assertEquals(expectedTime, test.testedTime(), expectedTime * 0.01);
    }

    @Test
    public void testConstructionOnLinearMargin(TestInfo info) {
        testConstructionOnLinearMargin(CONFIG_PATH, info);
    }

    /** Tests stacking mareco and construction margins */
    public static void testMarecoOnConstructionMargin(String configPath, TestInfo info) {
        // setup allowances
        var constructionAllowance = new ConstructionAllowance(30);
        constructionAllowance.beginPosition = 3000.;
        constructionAllowance.endPosition = 5000.;
        var marecoAllowance = new MarecoAllowance(MarecoAllowance.MarginType.TIME, 10);
        var allowances = new RJSAllowance[][] { { constructionAllowance }, { marecoAllowance } };

        // run the baseline and testing simulation
        var config = TestConfig.readResource(configPath).clearAllowances();
        var test = ComparativeTest.from(config, () -> config.setAllAllowances(allowances));
        test.saveGraphs(info);

        // compare the results
        var expected = (
                (test.baseTime() + constructionAllowance.allowanceValue)
                        * (1 + marecoAllowance.allowanceValue / 100)
        );
        assertEquals(expected, test.testedTime(), expected * 0.01);
    }

    @Test
    public void testMarecoOnConstructionMargin(TestInfo info) {
        testMarecoOnConstructionMargin(CONFIG_PATH, info);
    }

    /** Tests mareco */
    public static void testEcoMargin(String configPath, double value, TestInfo info) {
        // setup allowances
        var marecoAllowance = new MarecoAllowance(MarecoAllowance.MarginType.TIME, value);

        // run the baseline and testing simulation
        var config = TestConfig.readResource(configPath).clearAllowances();
        var test = ComparativeTest.from(config, () -> config.setAllAllowances(marecoAllowance));
        test.saveGraphs(info);

        var expected = test.baseTime() * (1 + value / 100);
        assertEquals(expected, test.testedTime(), 6);
    }

    @ParameterizedTest
    @ValueSource(doubles = {0.0, 10, 30, 200})
    public void testEcoMargin(double value, TestInfo info) {
        testEcoMargin(CONFIG_PATH, value, info);
    }

    @ParameterizedTest
    @ValueSource(ints = {0, 1, 2, 3, 4, 5, 6, 7})
    public void testDifferentSlopes(int slopeProfile, TestInfo info) {
        testDifferentSlopes(CONFIG_PATH, slopeProfile, info);
    }

    /** Test mareco with different slopes*/
    public static void testDifferentSlopes(String configPath, int slopeProfile, TestInfo info) {
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
                throw new RuntimeException("Unable to handle this parameter in testDifferentSlopes");
        }

        var marecoAllowance = new MarecoAllowance(MarecoAllowance.MarginType.TIME, margin);

        // build sims
        var config = TestConfig.readResource(configPath).clearAllowances();
        for (var trackSection : config.rjsInfra.trackSections)
            if ("ne.micro.foo_to_bar".equals(trackSection.id))
                trackSection.slopes = slopes;
        var test = ComparativeTest.from(config, () -> config.setAllAllowances(marecoAllowance));
        test.saveGraphs(info);

        var expected = test.baseTime() * (1 + margin / 100);
        assertEquals(expected, test.testedTime(), 5 + 0.001 * expected);

        var coastingSpeedControllers =
                findCoastingSpeedControllers(
                        test.testedState.schedules.get(0).speedInstructions.targetSpeedControllers
                );
        for (var controller : coastingSpeedControllers) {
            assertLowerSpeedPerPositionBetween(
                    test.baseEvents, test.testedEvents,
                    controller.beginPosition, controller.endPosition
            );
        }
    }

    /** Test the linear allowance type TIME */
    @ParameterizedTest
    @ValueSource(doubles = {0.0, 20, 100})
    public void testTimeMargin(double value, TestInfo info) {
        // setup allowances
        var allowance = new LinearAllowance(TIME, value);

        // run the baseline and testing simulation
        var config = TestConfig.readResource(CONFIG_PATH).clearAllowances();
        var test = ComparativeTest.from(config, () -> config.setAllAllowances(allowance));
        test.saveGraphs(info);

        var expected = test.baseTime() * (1 + value / 100);
        assertEquals(expected, test.testedTime(), expected * 0.01);
    }

    /** Test the linear allowance type DISTANCE */
    @ParameterizedTest
    @ValueSource(doubles = {0.0, 270})
    public void testDistanceMargin(double value, TestInfo info) {
        var allowance = new LinearAllowance(LinearAllowance.MarginType.DISTANCE, value);

        var config = TestConfig.readResource(CONFIG_PATH).clearAllowances();
        var test = ComparativeTest.from(config, () -> config.setAllAllowances(allowance));
        test.saveGraphs(info);

        var schedule = test.testedState.schedules.get(0);
        var start = schedule.initialLocation;
        var end = schedule.phases.get(0).getEndLocation();
        var distance = convertTrackLocation(end, schedule) - convertTrackLocation(start, schedule);
        var expectedExtraTime = value * distance / 100000;
        var expected = test.baseTime() + expectedExtraTime;

        assertEquals(expected, test.testedTime(), expected * 0.01);
    }

    @Test
    public void testSameSpeedLimits(TestInfo info) {
        final var globalAllowance = new LinearAllowance(TIME, 50);

        double marginChangeLocation = 5000;
        var startMargin = new LinearAllowance(TIME, 50);
        startMargin.beginPosition = 0.;
        startMargin.endPosition = marginChangeLocation;
        var endMargin = new LinearAllowance(TIME, 50);
        endMargin.beginPosition = marginChangeLocation;
        var splitAllowances = new RJSAllowance[][] { { startMargin, endMargin } };

        var config = TestConfig.readResource(CONFIG_PATH)
                .clearAllowances()
                .setAllAllowances(globalAllowance);
        var test = ComparativeTest.from(config,
                () -> config.setAllAllowances(splitAllowances));
        test.saveGraphs(info);

        assertSameSpeedPerPosition(test.baseEvents, test.testedEvents);
    }

    @Test
    public void testDifferentSpeedLimits(TestInfo info) {
        double marginChangeLocation = 5000;
        var startMargin = new LinearAllowance(TIME, 20);
        startMargin.beginPosition = 0.;
        startMargin.endPosition = marginChangeLocation;
        var endMargin = new LinearAllowance(TIME, 60);
        endMargin.beginPosition = marginChangeLocation;
        var allowances = new RJSAllowance[][] { { startMargin }, { endMargin } };

        var config = TestConfig.readResource(CONFIG_PATH).clearAllowances();
        var test = ComparativeTest.from(config, () -> config.setAllAllowances(allowances));
        test.saveGraphs(info);

        var baseTimePerPosition = getTimePerPosition(test.baseEvents);
        final var marginChangeTime = baseTimePerPosition.interpolate(marginChangeLocation);

        var expected = marginChangeTime * (1 + startMargin.allowanceValue / 100)
                + (test.baseTime() - marginChangeTime) * (1 + endMargin.allowanceValue / 100);
        assertEquals(expected, test.testedTime(), expected * 0.01);
    }

    /** Test stacking multiple construction margins */
    public static void testSeveralConstructionMargins(String configPath, TestInfo info) {
        double marginChangeLocation = 5000;
        var startMargin = new ConstructionAllowance(15);
        startMargin.beginPosition = 0.;
        startMargin.endPosition = marginChangeLocation;
        var endMargin = new ConstructionAllowance(30);
        endMargin.beginPosition = marginChangeLocation;
        var allowances = new RJSAllowance[][] { { startMargin }, { endMargin } };

        var config = TestConfig.readResource(configPath).clearAllowances();
        var test = ComparativeTest.from(config, () -> config.setAllAllowances(allowances));
        test.saveGraphs(info);

        var expected = test.baseTime() + startMargin.allowanceValue + endMargin.allowanceValue;

        assertEquals(expected, test.testedTime(), expected * 0.01);
    }

    @Test
    public void testSeveralConstructionMargins(TestInfo info) {
        testSeveralConstructionMargins(CONFIG_PATH, info);
    }


    private double convertTrackLocation(TrackSectionLocation location, TrainSchedule schedule) {
        double sumPreviousSections = 0;
        for (var edge : schedule.plannedPath.trackSectionPath) {
            if (edge.containsLocation(location)) {
                return sumPreviousSections + location.offset;
            }
            sumPreviousSections += edge.getEndPosition() - edge.getBeginPosition();
        }
        throw new RuntimeException("Can't find location in path");
    }

    @Test
    public void testDifferentMargins(TestInfo info) {
        double marginChangeLocation = 5000;
        var startMargin = new LinearAllowance(TIME, 10);
        startMargin.beginPosition = 0.;
        startMargin.endPosition = marginChangeLocation;
        var endMargin = new LinearAllowance(TIME, 60);
        endMargin.beginPosition = marginChangeLocation;
        var allowances = new RJSAllowance[][] { { startMargin }, { endMargin } };

        var config = TestConfig.readResource(CONFIG_PATH).clearAllowances();
        var test = ComparativeTest.from(config, () -> config.setAllAllowances(allowances));
        test.saveGraphs(info);

        // We don't test the whole range as the speeds can be *slightly* different
        // during the transition or when close to 0 (see also issue with shifted speed limits)
        assertSameSpeedPerPositionBetween(test.baseEvents, test.testedEvents, 10, 2000,
                1 / (1 + startMargin.allowanceValue / 100));
        assertSameSpeedPerPositionBetween(test.baseEvents, test.testedEvents, 6000, 9000,
                1 / (1 + endMargin.allowanceValue / 100));
    }
}
