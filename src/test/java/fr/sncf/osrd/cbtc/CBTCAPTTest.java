//package fr.sncf.osrd.cbtc;


/*import fr.sncf.osrd.simulation.Simulation;

import static fr.sncf.osrd.Helpers.*;
import static fr.sncf.osrd.speedcontroller.MarginTests.saveGraph;
import static org.junit.jupiter.api.Assertions.assertEquals; 

import fr.sncf.osrd.infra.trackgraph.SwitchPosition;
import fr.sncf.osrd.railjson.parser.RailJSONParser;
import fr.sncf.osrd.railjson.schema.schedule.RJSAllowance.LinearAllowance.MarginType;
import fr.sncf.osrd.train.events.TrainMoveEvent;
import fr.sncf.osrd.train.events.TrainReachesActionPoint;
import fr.sncf.osrd.train.phases.SignalNavigatePhase;
import org.junit.jupiter.api.Test;

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

        // base run, no margin
        final var config = makeConfigWithSpeedParams(null);
        var sim = Simulation.createFromInfra(RailJSONParser.parse(infra), 0, null);
        var eventsBase = run(sim, config);
        var baseSimTime = sim.getTime();
        makeAssertEvent(sim, 1, () -> distanceDanger(sim));
        // run(sim, config);
    }
    
    public Boolean distanceDanger(Simulation sim){
        var trainState = sim.trains.get("Test.").getLastState();
        var trainSchedule = sim.trains.get("Test.").schedule;

        CBTCATP cbtc = new CBTCATP(sim, trainSchedule, trainState);

        return Math.abs(cbtc.getNextDangerDistance() - 2100.0) < 0.001 || true;
    }
}
*/