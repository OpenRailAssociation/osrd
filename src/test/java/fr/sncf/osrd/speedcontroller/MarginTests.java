package fr.sncf.osrd.speedcontroller;

import fr.sncf.osrd.TrainSchedule;
import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.railjson.parser.RailJSONParser;
import fr.sncf.osrd.railjson.schema.schedule.RJSAllowance;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.simulation.TimelineEvent;
import fr.sncf.osrd.train.Train;
import fr.sncf.osrd.train.events.TrainMoveEvent;
import fr.sncf.osrd.train.events.TrainReachesActionPoint;
import fr.sncf.osrd.utils.TrackSectionLocation;
import org.junit.jupiter.api.Test;

import java.io.FileNotFoundException;
import java.io.PrintWriter;
import java.io.UnsupportedEncodingException;
import java.util.ArrayList;
import java.util.Collections;

import static fr.sncf.osrd.Helpers.*;
import static org.junit.jupiter.api.Assertions.assertEquals;

public class MarginTests {

    private static final boolean saveCSVFiles = true;

    @Test
    public void testConstructionMargins() throws InvalidInfraException {
        var infra = getBaseInfra();
        assert infra != null;
        var params = new RJSAllowance.ConstructionAllowance();
        params.allowanceValue = 30;

        // base run, no margin
        var config = makeConfigWithSpeedParams(null);
        var sim = Simulation.createFromInfra(RailJSONParser.parse(infra), 0, null);
        var eventsBase = run(sim, config);
        var baseSimTime = sim.getTime();

        // Run with construction margin
        var configMargins = makeConfigWithSpeedParams(Collections.singletonList(params));
        var sim2 = Simulation.createFromInfra(RailJSONParser.parse(infra), 0, null);
        var events = run(sim2, configMargins);
        var marginsSimTime = sim2.getTime();

        var expected = baseSimTime + params.allowanceValue;

        assertEquals(expected, marginsSimTime, expected * 0.01);
        saveGraph(eventsBase, "construction-base.csv");
        saveGraph(events, "construction-out.csv");
    }

    @Test
    public void testConstructionOnLinearMargin() throws InvalidInfraException {
        var infra = getBaseInfra();
        assert infra != null;
        var params1 = new RJSAllowance.LinearAllowance();
        params1.allowanceType = RJSAllowance.LinearAllowance.MarginType.TIME;
        params1.allowanceValue = 10;
        var params2 = new RJSAllowance.ConstructionAllowance();
        params2.allowanceValue = 15;

        var params = new ArrayList<RJSAllowance>();
        params.add(params1);
        params.add(params2);

        // Run with construction margin
        var configMargins = makeConfigWithSpeedParams(params);
        var sim2 = Simulation.createFromInfra(RailJSONParser.parse(infra), 0, null);
        var events = run(sim2, configMargins);
        var marginsSimTime = sim2.getTime();

        // base run, no margin
        var config = makeConfigWithSpeedParams(null);
        var sim = Simulation.createFromInfra(RailJSONParser.parse(infra), 0, null);
        var eventsBase = run(sim, config);
        var baseSimTime = sim.getTime();

        var expected = baseSimTime * 1.1 + 15;

        assertEquals(expected, marginsSimTime, expected * 0.01);

        saveGraph(eventsBase, "linear-time-on-construction-base.csv");
        saveGraph(events, "linear-time-on-construction-out.csv");
    }

    @Test
    public void testLargerEcoMargin() throws InvalidInfraException {
        var infra = getBaseInfra();
        var params = new RJSAllowance.MarecoAllowance();
        params.allowanceValue = 200;
        params.allowanceType = RJSAllowance.MarecoAllowance.MarginType.TIME;

        // Run with construction margin
        var configMargins = makeConfigWithSpeedParams(Collections.singletonList(params));
        var sim2 = Simulation.createFromInfra(RailJSONParser.parse(infra), 0, null);
        var events = run(sim2, configMargins);
        var marginsSimTime = sim2.getTime();

        // base run, no margin
        var config = makeConfigWithSpeedParams(null);
        var sim = Simulation.createFromInfra(RailJSONParser.parse(infra), 0, null);
        var eventsBase = run(sim, config);
        var baseSimTime = sim.getTime();

        var expected = baseSimTime * (1 + params.allowanceValue / 100);
        assertEquals(expected, marginsSimTime, expected * 0.1);

        saveGraph(eventsBase, "eco-base.csv");
        saveGraph(events, "eco-out.csv");
    }

    @Test
    public void testEcoMargin() throws InvalidInfraException {
        var infra = getBaseInfra();
        assert infra != null;
        var params = new RJSAllowance.MarecoAllowance();
        params.allowanceValue = 10;
        params.allowanceType = RJSAllowance.MarecoAllowance.MarginType.TIME;

        // Run with construction margin
        var configMargins = makeConfigWithSpeedParams(Collections.singletonList(params));
        var sim2 = Simulation.createFromInfra(RailJSONParser.parse(infra), 0, null);
        var events = run(sim2, configMargins);
        var marginsSimTime = sim2.getTime();

        // base run, no margin
        var config = makeConfigWithSpeedParams(null);
        var sim = Simulation.createFromInfra(RailJSONParser.parse(infra), 0, null);
        var eventsBase = run(sim, config);
        var baseSimTime = sim.getTime();

        var expected = baseSimTime * 1.1;
        assertEquals(expected, marginsSimTime, expected * 0.01);

        saveGraph(eventsBase, "eco-base.csv");
        saveGraph(events, "eco-out.csv");
    }

    public static void saveGraph(ArrayList<TimelineEvent> events, String path) {
        if (!saveCSVFiles)
            return;
        if (events == null)
            throw new RuntimeException();
        try {
            PrintWriter writer = new PrintWriter(path, "UTF-8");
            writer.println("position,time,speed");
            for (var event : events) {
                if (event instanceof TrainReachesActionPoint) {
                    var updates = ((TrainReachesActionPoint) event).trainStateChange.positionUpdates;
                    for (var update : updates) {
                        writer.println(String.format("%f,%f,%f", update.pathPosition, update.time, update.speed));
                    }
                }
                else if (event instanceof TrainMoveEvent) {
                    var updates = ((TrainMoveEvent) event).trainStateChange.positionUpdates;
                    for (var update : updates) {
                        writer.println(String.format("%f,%f,%f", update.pathPosition, update.time, update.speed));
                    }
                }
            }
            writer.close();
        } catch (FileNotFoundException | UnsupportedEncodingException e) {
            e.printStackTrace();
        }
    }

    @Test
    public void testConstructionMarginsNoAllowance() throws InvalidInfraException {
        var infra = getBaseInfra();
        assert infra != null;
        var params = new RJSAllowance.ConstructionAllowance();
        params.allowanceValue = 0;

        // base run, no margin
        var config = makeConfigWithSpeedParams(null);
        var sim = Simulation.createFromInfra(RailJSONParser.parse(infra), 0, null);
        run(sim, config);
        var baseSimTime = sim.getTime();

        // Run with construction margin
        var configMargins = makeConfigWithSpeedParams(Collections.singletonList(params));
        var sim2 = Simulation.createFromInfra(RailJSONParser.parse(infra), 0, null);
        run(sim2, configMargins);
        var marginsSimTime = sim2.getTime();

        assertEquals(baseSimTime, marginsSimTime, 0.5);
    }

    @Test
    public void testTimeMargin() throws InvalidInfraException {
        var infra = getBaseInfra();
        assert infra != null;
        var params = new RJSAllowance.LinearAllowance();
        params.allowanceType = RJSAllowance.LinearAllowance.MarginType.TIME;
        params.allowanceValue = 20; // percents

        // base run, no margin
        var config = makeConfigWithSpeedParams(null);
        var sim = Simulation.createFromInfra(RailJSONParser.parse(infra), 0, null);
        var eventsBase = run(sim, config);
        var baseSimTime = sim.getTime();

        // Run with 20% margins
        var configMargins = makeConfigWithSpeedParams(Collections.singletonList(params));
        var sim2 = Simulation.createFromInfra(RailJSONParser.parse(infra), 0, null);
        var events = run(sim2, configMargins);
        var marginsSimTime = sim2.getTime();

        var expected = baseSimTime * 1.2;

        assertEquals(expected, marginsSimTime, expected * 0.01);
        saveGraph(eventsBase, "linear-time-base.csv");
        saveGraph(events, "linear-time-out.csv");
    }

    @Test
    public void testDistanceMargin() throws InvalidInfraException {
        var infra = getBaseInfra();
        assert infra != null;
        var params = new RJSAllowance.LinearAllowance();
        params.allowanceType = RJSAllowance.LinearAllowance.MarginType.DISTANCE;
        params.allowanceValue = 270; // seconds per 100km

        // base run, no margin
        var config = makeConfigWithSpeedParams(null);
        var sim = Simulation.createFromInfra(RailJSONParser.parse(infra), 0, null);
        var eventsBase = run(sim, config);
        var baseSimTime = sim.getTime();

        // Run with 50% margins
        var configMargins = makeConfigWithSpeedParams(Collections.singletonList(params));
        var sim2 = Simulation.createFromInfra(RailJSONParser.parse(infra), 0, null);
        var events = run(sim2, configMargins);
        var marginsSimTime = sim2.getTime();

        var schedule = configMargins.trainSchedules.get(0);
        var start = schedule.initialLocation;
        var end = schedule.phases.get(0).getEndLocation();
        var distance = convertTrackLocation(end, schedule) - convertTrackLocation(start, schedule);
        var expectedExtraTime = params.allowanceValue * distance / 100000;
        var expected = baseSimTime + expectedExtraTime;

        assertEquals(expected, marginsSimTime, expected * 0.01);
        saveGraph(eventsBase, "linear-distance-base.csv");
        saveGraph(events, "linear-distance-out.csv");
    }

    private double convertTrackLocation(TrackSectionLocation location, TrainSchedule schedule) {
        double sumPreviousSections = 0;
        for (var edge : schedule.fullPath) {
            if (edge.containsLocation(location)) {
                return sumPreviousSections + location.offset;
            }
            sumPreviousSections += edge.getEndPosition() - edge.getBeginPosition();
        }
        throw new RuntimeException("Can't find location in path");
    }
}
