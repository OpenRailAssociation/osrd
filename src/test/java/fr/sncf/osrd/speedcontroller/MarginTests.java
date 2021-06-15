package fr.sncf.osrd.speedcontroller;

import fr.sncf.osrd.TrainSchedule;
import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.railjson.parser.RailJSONParser;
import fr.sncf.osrd.railjson.schema.schedule.RJSAllowance;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.utils.TrackSectionLocation;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.Collections;

import static fr.sncf.osrd.Helpers.*;
import static org.junit.jupiter.api.Assertions.assertEquals;

public class MarginTests {

    @Test
    public void testConstructionMargins() throws InvalidInfraException {
        var infra = getBaseInfra();
        assert infra != null;
        var params = new RJSAllowance.ConstructionAllowance();
        params.allowanceValue = 30;

        // base run, no margin
        var config = makeConfigWithSpeedParams(null);
        assert config != null;
        var sim = Simulation.createFromInfra(RailJSONParser.parse(infra), 0, null);
        run(sim, config);
        var baseSimTime = sim.getTime();

        // Run with construction margin
        var configMargins = makeConfigWithSpeedParams(Collections.singletonList(params));
        assert configMargins != null;
        var sim2 = Simulation.createFromInfra(RailJSONParser.parse(infra), 0, null);
        run(sim2, configMargins);
        var marginsSimTime = sim2.getTime();

        var expected = baseSimTime + params.allowanceValue;

        assertEquals(expected, marginsSimTime, expected * 0.01);
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
        assert configMargins != null;
        var sim2 = Simulation.createFromInfra(RailJSONParser.parse(infra), 0, null);
        run(sim2, configMargins);
        var marginsSimTime = sim2.getTime();

        // base run, no margin
        var config = makeConfigWithSpeedParams(null);
        assert config != null;
        var sim = Simulation.createFromInfra(RailJSONParser.parse(infra), 0, null);
        run(sim, config);
        var baseSimTime = sim.getTime();

        var expected = baseSimTime * 1.1 + 15;

        assertEquals(expected, marginsSimTime, expected * 0.01);
    }

    @Test
    public void testEcoMargin() throws InvalidInfraException {
        var infra = getBaseInfra();
        assert infra != null;
        var params = new RJSAllowance.MarecoAllowance();
        params.allowanceValue = 10;
        params.allowanceType = RJSAllowance.MarecoAllowance.MarginType.TIME;

        // base run, no margin
        var config = makeConfigWithSpeedParams(null);
        assert config != null;
        var sim = Simulation.createFromInfra(RailJSONParser.parse(infra), 0, null);
        run(sim, config);
        var baseSimTime = sim.getTime();

        // Run with construction margin
        var configMargins = makeConfigWithSpeedParams(Collections.singletonList(params));
        assert configMargins != null;
        var sim2 = Simulation.createFromInfra(RailJSONParser.parse(infra), 0, null);
        run(sim2, configMargins);
        var marginsSimTime = sim2.getTime();

        var expected = baseSimTime * 1.1;
        assertEquals(expected, marginsSimTime, expected * 0.01);
    }

    @Test
    public void testConstructionMarginsNoAllowance() throws InvalidInfraException {
        var infra = getBaseInfra();
        assert infra != null;
        var params = new RJSAllowance.ConstructionAllowance();
        params.allowanceValue = 0;

        // base run, no margin
        var config = makeConfigWithSpeedParams(null);
        assert config != null;
        var sim = Simulation.createFromInfra(RailJSONParser.parse(infra), 0, null);
        run(sim, config);
        var baseSimTime = sim.getTime();

        // Run with construction margin
        var configMargins = makeConfigWithSpeedParams(Collections.singletonList(params));
        assert configMargins != null;
        var sim2 = Simulation.createFromInfra(RailJSONParser.parse(infra), 0, null);
        run(sim2, configMargins);
        var marginsSimTime = sim2.getTime();

        assertEquals(baseSimTime, marginsSimTime, 0.5);
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
        assert config != null;
        var sim = Simulation.createFromInfra(RailJSONParser.parse(infra), 0, null);
        run(sim, config);
        var baseSimTime = sim.getTime();

        // Run with 50% margins
        var configMargins = makeConfigWithSpeedParams(Collections.singletonList(params));
        assert configMargins != null;
        var sim2 = Simulation.createFromInfra(RailJSONParser.parse(infra), 0, null);
        run(sim2, configMargins);
        var marginsSimTime = sim2.getTime();

        var schedule = configMargins.trainSchedules.get(0);
        var start = schedule.initialLocation;
        var end = schedule.phases.get(0).getEndLocation();
        var distance = convertTrackLocation(end, schedule) - convertTrackLocation(start, schedule);
        var expectedExtraTime = params.allowanceValue * distance / 100000;
        var expected = baseSimTime + expectedExtraTime;

        assertEquals(expected, marginsSimTime, expected * 0.01);
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
