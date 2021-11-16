package fr.sncf.osrd.speedcontroller;

import static fr.sncf.osrd.Helpers.getTimePerPosition;
import static fr.sncf.osrd.railjson.schema.schedule.RJSAllowance.LinearAllowance.MarginType.DISTANCE;
import static fr.sncf.osrd.railjson.schema.schedule.RJSAllowance.LinearAllowance.MarginType.TIME;
import static org.junit.jupiter.api.Assertions.assertEquals;

import fr.sncf.osrd.TestConfig;
import fr.sncf.osrd.railjson.schema.schedule.RJSAllowance;
import net.jqwik.api.*;
import java.util.ArrayList;
import java.util.Collections;

public class AllowanceTestsOnAllInfras {

    private static TestConfig readConfig(String rootPath) {
        var config = TestConfig.readResource(
                rootPath + "/infra.json",
                rootPath + "/simulation.json",
                Collections.singletonList("rolling_stocks"));
        return config.singleTrain().clearAllowances().clearSignalizationConstraints();
    }

    /** Runs simple linear allowance tests */
    @Property
    public void testLinearAllowanceTime(
            @ForAll("infraRootPaths") String rootPath,
            @ForAll("percentMarginValues") double value
    ) {
        var config = readConfig(rootPath);

        var allowance = new RJSAllowance.LinearAllowance(TIME, value);
        var test = MarginTests.ComparativeTest.from(config, () -> config.setAllAllowances(allowance));

        var start = config.rjsSimulation.trainSchedules.get(0).departureTime;
        var expected = start + (test.baseTime() - start) * (1 + value / 100);
        assertEquals(expected, test.testedTime(), expected * 0.02);
    }

    /** Runs simple distance linear allowance tests */
    @Property
    public void testLinearAllowanceDistance(
            @ForAll("infraRootPaths") String rootPath,
            @ForAll("distanceMarginValues") double value
    ) {
        var config = readConfig(rootPath);

        var allowance = new RJSAllowance.LinearAllowance(DISTANCE, value);
        var test = MarginTests.ComparativeTest.from(config, () -> config.setAllAllowances(allowance));

        var timesBase = getTimePerPosition(test.baseEvents);
        var schemaLength = timesBase.lastEntry().getKey() - timesBase.firstEntry().getKey();
        var expected = test.baseTime() + 60 * value * (schemaLength / 100000);
        assertEquals(expected, test.testedTime(), expected * 0.03);
    }

    /** Runs simple construction allowance tests */
    @Property
    public void testConstruction(
            @ForAll("infraRootPaths") String rootPath,
            @ForAll("secondsMarginValues") double value
    ) {
        var allowance = new RJSAllowance.ConstructionAllowance(value);

        var config = readConfig(rootPath);
        var test = MarginTests.ComparativeTest.from(config, () -> config.setAllAllowances(allowance));

        var start = config.rjsSimulation.trainSchedules.get(0).departureTime;
        var expected = start + (test.baseTime() - start) + value;
        assertEquals(expected, test.testedTime(), expected * 0.01);
    }

    /** Runs simple construction allowance tests */
    @Property
    public void testMareco(
            @ForAll("infraRootPaths") String rootPath,
            @ForAll("secondsMarginValues") double value
    ) {
        // setup allowances
        var marecoAllowance = new RJSAllowance.MarecoAllowance(RJSAllowance.MarecoAllowance.MarginType.TIME, value);

        // run the baseline and testing simulation
        var config = readConfig(rootPath);
        var test = MarginTests.ComparativeTest.from(config, () -> config.setAllAllowances(marecoAllowance));

        var start = config.rjsSimulation.trainSchedules.get(0).departureTime;
        var expected = start + (test.baseTime() - start) * (1 + value / 100);
        assertEquals(expected, test.testedTime(), 6);
    }

    @Provide
    Arbitrary<String> infraRootPaths() {
        var infras = new ArrayList<String>();
        infras.add("tiny_infra");
        infras.add("bug_convergences");
        infras.add("one_line");
        for (int i = 0; i < 10; i++)
            infras.add(String.format("generated/%s", i));
        return Arbitraries.of(infras);
    }

    @Provide
    Arbitrary<Double> percentMarginValues() {
        return Arbitraries.of(0., 50., 100., 200.);
    }

    @Provide
    Arbitrary<Double> secondsMarginValues() {
        return Arbitraries.of(0., 5., 30.);
    }

    @Provide
    Arbitrary<Double> distanceMarginValues() {
        return Arbitraries.of(0., 5., 10.);
    }
}
