package fr.sncf.osrd.railjson.schema.infra.railscript;

import static fr.sncf.osrd.Helpers.getBaseConfig;
import static fr.sncf.osrd.Helpers.getBaseInfra;
import static fr.sncf.osrd.Helpers.run;
import static fr.sncf.osrd.Helpers.runWithExceptions;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.HashMap;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.infra.railscript.RSExpr;
import fr.sncf.osrd.infra.railscript.RSExprState;
import fr.sncf.osrd.infra.signaling.Signal;
import fr.sncf.osrd.infra.trackgraph.SwitchPosition;
import fr.sncf.osrd.infra_state.RouteState;
import fr.sncf.osrd.railjson.parser.RailJSONParser;
import fr.sncf.osrd.railjson.parser.RailScriptExprParser;
import fr.sncf.osrd.railjson.schema.common.ID;
import fr.sncf.osrd.railjson.schema.infra.trackobjects.RJSSignal;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.simulation.SimulationError;

public class OptionalTests {

    @Test
    @Disabled("See issue https://github.com/DGEXSolutions/osrd-core/issues/129")
    public void testSignalsFunctionWithOptionals() throws InvalidInfraException, SimulationError {
        final var infra = getBaseInfra("tiny_infra/infra_optional.json");
        final var config = getBaseConfig("tiny_infra/config_railjson_optional.json");

        // We force a (very long) switch change, to make sure signals are necessary
        infra.switches.iterator().next().positionChangeDelay = 42;

        var sim = Simulation.createFromInfraAndEmptySuccessions(RailJSONParser.parse(infra), 0, null);
        sim.infraState.getSwitchState(0).setPosition(sim, SwitchPosition.RIGHT);
        run(sim, config);
    }

    @Test
    public void testSignalsFunctionWithOptionalsForcedGreen() throws InvalidInfraException, SimulationError {
        // Other half the test above: we check that invalid signals would have failed
        final var infra = getBaseInfra("tiny_infra/infra_optional.json");
        final var config = getBaseConfig("tiny_infra/config_railjson_optional.json");

        var functions = infra.scriptFunctions;
        var aspect = new RJSRSExpr.AspectSet.AspectSetMember(
                new ID<>("GREEN"),
                new RJSRSExpr.True());
        for (var f : functions) {
            f.body = new RJSRSExpr.AspectSet(new RJSRSExpr.AspectSet.AspectSetMember[]{aspect});
        }
        infra.switches.iterator().next().positionChangeDelay = 42;

        var sim = Simulation.createFromInfraAndEmptySuccessions(RailJSONParser.parse(infra), 0, null);
        sim.infraState.getSwitchState(0).setPosition(sim, SwitchPosition.RIGHT);
        assertThrows(SimulationError.class,
                () -> runWithExceptions(sim, config),
                "Expected a simulation error once the train goes through the switch"
        );
    }

    @Test
    void testThrowOnInvalidDelay() throws InvalidInfraException {
        var infra = getBaseInfra("tiny_infra/infra_optional.json");
        var sim = Simulation.createFromInfraAndEmptySuccessions(RailJSONParser.parse(infra), 0, null);
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
        final var infra = getBaseInfra();
        var sim = Simulation.createFromInfraAndEmptySuccessions(RailJSONParser.parse(infra), 0, null);

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
        
        // First, the route preceding the signal is free, so the evaluation must return null
        var result = state.evalInit(sim.infraState);
        assert result.value == null;

        // In a second time, we reserve the route preceding the signal, the result must not be null anymore
        RouteState routeState = sim.infraState.getRouteState(1);
        routeState.reserve(sim);
        result = state.evalInputChange(sim.infraState, null);
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
        
        // First, the route preceding the signal is free, so the evaluation must return null
        var result = state.evalInit(sim.infraState);
        assert result.value == null;

        // In a second time, we reserve the route preceding the signal, the result must not be null anymore
        RouteState routeState = sim.infraState.getRouteState(7);
        routeState.reserve(sim);
        result = state.evalInputChange(sim.infraState, null);
        assert result.value != null;
        assert result.value.route.id.equals("rt.81");
    }
}
