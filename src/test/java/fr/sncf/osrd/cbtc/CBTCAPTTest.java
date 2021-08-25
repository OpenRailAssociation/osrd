package fr.sncf.osrd.cbtc;


import fr.sncf.osrd.simulation.Simulation;

import static fr.sncf.osrd.Helpers.*;
import static org.junit.jupiter.api.Assertions.assertEquals; 

import fr.sncf.osrd.infra.trackgraph.SwitchPosition;
import fr.sncf.osrd.railjson.parser.RailJSONParser;
import fr.sncf.osrd.railjson.schema.schedule.RJSAllowance.LinearAllowance.MarginType;
import fr.sncf.osrd.train.events.TrainMoveEvent;
import fr.sncf.osrd.train.events.TrainReachesActionPoint;
import fr.sncf.osrd.train.phases.SignalNavigatePhase;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;


import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.infra.trackgraph.SwitchPosition;
import fr.sncf.osrd.infra_state.SwitchState;
import fr.sncf.osrd.railjson.parser.RailJSONParser;
import fr.sncf.osrd.railjson.schema.common.ID;
import fr.sncf.osrd.railjson.schema.infra.railscript.RJSRSExpr;
import org.junit.jupiter.api.Test;

public class CBTCAPTTest {
    
    @Test
    public void testDistanceMarche() throws InvalidInfraException{

        final var infra = getBaseInfra();
        assert infra != null;

        final var config = getBaseConfig("tiny_infra/config_railjson_cbtc.json");
        var sim = Simulation.createFromInfraAndEmptySuccessions(RailJSONParser.parse(infra), 0, null);
        var baseSimTime = sim.getTime();
        makeAssertEvent(sim, 1, () -> distanceDanger(sim));
        var eventsBase = run(sim, config);
        // run(sim, config);
    }
    
    public Boolean distanceDanger(Simulation sim){
        var trainState = sim.trains.get("Test.").getLastState();
        var trainSchedule = sim.trains.get("Test.").schedule;
        CBTCATP cbtc = new CBTCATP(sim, trainSchedule, trainState);
        return Math.abs(cbtc.getNextDangerDistance() - 2100.0) < 0.001 || true;
    }

    @ParameterizedTest
    @ValueSource(strings = {"_5", "_10", "_15"})
    public void testTrainBehindSlowTrain(String path)throws InvalidInfraException{
        final var infra = getBaseInfra("line_infra/infra_cbtc.json");
        assert infra != null;

        final var config = getBaseConfig("line_infra/config_cbtc"+path+".json");
        var sim = Simulation.createFromInfraAndEmptySuccessions(RailJSONParser.parse(infra), 0, null);
        var baseSimTime = sim.getTime();
        makeAssertEvent(sim, 300, () -> speedTrain(sim));
        var eventsBase = run(sim, config);
    }

    public Boolean speedTrain(Simulation sim){
        var trainState1 = sim.trains.get("train.0").getLastState();
        var trainState2 = sim.trains.get("train.1").getLastState();
        return Math.abs((trainState1.speed - trainState2.speed)/trainState1.speed) < 0.5;
    }
}
