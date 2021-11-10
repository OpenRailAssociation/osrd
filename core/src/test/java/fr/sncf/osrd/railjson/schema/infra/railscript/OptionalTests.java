package fr.sncf.osrd.railjson.schema.infra.railscript;

import static fr.sncf.osrd.Helpers.getBaseInfra;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.HashMap;
import fr.sncf.osrd.TestConfig;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.infra.railscript.RSExpr;
import fr.sncf.osrd.infra.railscript.RSExprState;
import fr.sncf.osrd.infra.signaling.Signal;
import fr.sncf.osrd.infra_state.routes.RouteState;
import fr.sncf.osrd.railjson.parser.RailJSONParser;
import fr.sncf.osrd.railjson.parser.RailScriptExprParser;
import fr.sncf.osrd.railjson.schema.common.ID;
import fr.sncf.osrd.railjson.schema.infra.trackobjects.RJSSignal;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.simulation.SimulationError;

public class OptionalTests {
    @Test
    public void testSignalsFunctionWithOptionals() throws SimulationError {
        var testConfig = TestConfig.readResource("tiny_infra/config_railjson_optional.json");

        // We force a (very long) switch change, to make sure signals are necessary
        testConfig.rjsInfra.switches.iterator().next().groupChangeDelay = 42;

        var simState = testConfig.prepare();
        var sim = simState.sim;
        sim.infraState.getSwitchState(0).setGroup(sim, "RIGHT");

        simState.run();
    }

    @Test
    public void testSignalsFunctionWithOptionalsForcedGreen() throws SimulationError {
        var testConfig = TestConfig.readResource("tiny_infra/config_railjson_optional.json");

        var functions = testConfig.rjsInfra.scriptFunctions;
        var aspect = new RJSRSExpr.AspectSet.AspectSetMember(
                new ID<>("GREEN"),
                new RJSRSExpr.True());
        for (var f : functions) {
            f.body = new RJSRSExpr.AspectSet(new RJSRSExpr.AspectSet.AspectSetMember[]{aspect});
        }
        testConfig.rjsInfra.switches.iterator().next().groupChangeDelay = 42;

        var simState = testConfig.prepare();
        var sim = simState.sim;

        sim.infraState.getSwitchState(0).setGroup(sim, "RIGHT");
        assertThrows(SimulationError.class,
                simState::runWithExceptions,
                "Expected a simulation error once the train goes through the switch"
        );
    }

    @Test
    void testThrowOnInvalidDelay() throws InvalidInfraException {
        var testConfig = TestConfig.readResource("tiny_infra/config_railjson_optional.json");
        var simState = testConfig.prepare();
        var sim = simState.sim;
        var trueExpr = new RJSRSExpr.True();
        var delay = new RJSRSExpr.Delay(0, trueExpr);
        var signalId = new ID<RJSSignal>(sim.infraState.getSignalState(0).signal.id);
        var optional = new RJSRSExpr.ReservedRoute(new RJSRSExpr.SignalRef(signalId));

        assertThrows(InvalidInfraException.class,
                () -> tryInstanciate(sim, new RJSRSExpr.OptionalMatch(optional, trueExpr, delay, "foo")),
                "Expected an invalid infra because of the delay in the match expression"
        );
        // but no exception here (delays are in the other branches)
        tryInstanciate(sim, new RJSRSExpr.OptionalMatch(optional, delay, trueExpr, "foo"));
        tryInstanciate(sim, new RJSRSExpr.OptionalMatch(
                new RJSRSExpr.Delay(0, optional), trueExpr, trueExpr, "foo")
        );
    }

    static void tryInstanciate(Simulation sim, RJSRSExpr expr) throws InvalidInfraException {
        new RailScriptExprParser(sim.infra.aspects, new HashMap<>()).parse(expr);
    }

    /**
     * Check that the previous_reserved_route primitive return the expected value in TinyInfra
     */
    @Test
    public void testPreviousReservedRouteTinyInfra() throws InvalidInfraException, SimulationError {
        var testConfig = TestConfig.readResource("tiny_infra/config_railjson.json");
        var simState = testConfig.prepare();
        var sim = simState.sim;

        // Creation of the SignalRef 
        var signal = new RSExpr.SignalRef("il.sig.C3");
        // build name maps to prepare resolving names in expressions
        var signalNames = new HashMap<String, Signal>();
        for (var s : sim.infra.signals)
            signalNames.put(s.id, s);
        signal.resolve(signalNames);
        
        // Creation of the PreviousReservedRoute expression
        var previousReserveRoute = new RSExpr.PreviousReservedRoute(signal);
        // Creation of the state for the evaluation
        var state = new RSExprState<>(previousReserveRoute, 0, 0);
        
        // The previous route doesn't need to be reserved, so it should be returned even with no reservation
        var result = state.evalInit(sim.infraState);
        assert result.value != null;
        assert result.value.route.id.equals("rt.buffer_stop_b-C3");
    }

    /**
     * Check that the previous_reserved_route primitive return the expected value in TinyInfra
     */
    @Test
    public void testPreviousReservedRouteCircularInfra() throws InvalidInfraException, SimulationError {
        final var infra = getBaseInfra("circular_infra/infra.json");
        var sim = Simulation.createFromInfraAndEmptySuccessions(RailJSONParser.parse(infra), 0, null);

        // Creation of the SignalRef 
        var signal = new RSExpr.SignalRef("sig.1");
        // build name maps to prepare resolving names in expressions
        var signalNames = new HashMap<String, Signal>();
        for (var s : sim.infra.signals)
            signalNames.put(s.id, s);
        signal.resolve(signalNames);
        
        // Creation of the PreviousReservedRoute expression
        var previousReserveRoute = new RSExpr.PreviousReservedRoute(signal);
        // Creation of the state for the evaluation
        var state = new RSExprState<>(previousReserveRoute, 0, 0);

        // The previous route doesn't need to be reserved, so it should be returned even with no reservation
        var result = state.evalInit(sim.infraState);
        assert result.value != null;
        assert result.value.route.id.equals("rt.81");
    }
}
