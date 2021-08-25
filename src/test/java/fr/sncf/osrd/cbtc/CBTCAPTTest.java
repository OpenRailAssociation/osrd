package fr.sncf.osrd.cbtc;

import fr.sncf.osrd.simulation.Simulation;

import static fr.sncf.osrd.Helpers.*;

import fr.sncf.osrd.railjson.parser.RailJSONParser;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import fr.sncf.osrd.infra.InvalidInfraException;

public class CBTCAPTTest {

    /**
     * Test if the distance to the end of the track is correct
     * 
     * @throws InvalidInfraException
     */
    @Test
    public void testDistanceMarche() throws InvalidInfraException {

        final var infra = getBaseInfra("line_infra/infra_cbtc.json");
        assert infra != null;

        final var config = getBaseConfig("line_infra/config_cbtc.json");
        var sim = Simulation.createFromInfraAndEmptySuccessions(RailJSONParser.parse(infra), 0, null);
        makeAssertEvent(sim, 0.01, () -> distanceDanger(sim));
        run(sim, config);
        // run(sim, config);
    }

    private Boolean distanceDanger(Simulation sim) {
        var trainState = sim.trains.get("train.0").getLastState();
        var trainSchedule = sim.trains.get("train.0").schedule;
        CBTCATP cbtc = new CBTCATP(sim, trainSchedule, trainState);
        return Math.abs(cbtc.getNextDangerDistance() - 9000) < 0.001;
    }

    @Test
    public void testDistanceTrain() throws InvalidInfraException {
        final var infra = getBaseInfra("line_infra/infra_cbtc.json");
        assert infra != null;

        final var config = getBaseConfig("line_infra/config_cbtc_test_2trains.json");
        var sim = Simulation.createFromInfraAndEmptySuccessions(RailJSONParser.parse(infra), 0, null);
        makeAssertEvent(sim, 0.01, () -> distanceTrain(sim));
        run(sim, config);
    }

    private boolean distanceTrain(Simulation sim) {
        var trainSchedule1 = sim.trains.get("train.0").schedule;
        var trainSchedule2 = sim.trains.get("train.1").schedule;
        var trainState2 = sim.trains.get("train.1").getLastState();
        CBTCATP cbtc = new CBTCATP(sim, trainSchedule2, trainState2);
        cbtc.getNextDangerDistance();
        return Math.abs(cbtc.getNextDangerDistance() - (1000 - trainSchedule1.rollingStock.length)) < 0.01;
    }

    /**
     * test if a speed train is capable of following a slow train with the same speed in
     * less than 400 seconds
     * 
     * @param path Different infra paths for different speeds
     * @throws InvalidInfraException
     */
    @ParameterizedTest
    @ValueSource(strings = { "_10", "_15", "_20" })
    public void testTrainBehindSlowTrain(String path) throws InvalidInfraException {
        final var infra = getBaseInfra("line_infra/infra_cbtc.json");
        assert infra != null;

        final var config = getBaseConfig("line_infra/config_cbtc" + path + ".json");
        var sim = Simulation.createFromInfraAndEmptySuccessions(RailJSONParser.parse(infra), 0, null);
        makeAssertEvent(sim, 400, () -> speedTrain(sim));
        run(sim, config);
    }

    private Boolean speedTrain(Simulation sim) {
        var trainState1 = sim.trains.get("train.0").getLastState();
        var trainState2 = sim.trains.get("train.1").getLastState();
        return Math.abs((trainState1.speed - trainState2.speed) / trainState1.speed) < 0.05;
    }
}
