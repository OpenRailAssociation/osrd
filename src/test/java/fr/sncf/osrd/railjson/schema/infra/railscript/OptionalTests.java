package fr.sncf.osrd.railjson.schema.infra.railscript;

import static fr.sncf.osrd.Helpers.*;
import static org.junit.jupiter.api.Assertions.assertThrows;

import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.railjson.parser.RailJSONParser;
import fr.sncf.osrd.railjson.parser.RailScriptExprParser;
import fr.sncf.osrd.railjson.schema.common.ID;
import fr.sncf.osrd.railjson.schema.infra.RJSSwitch;
import fr.sncf.osrd.railjson.schema.infra.trackobjects.RJSSignal;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.simulation.SimulationError;
import org.junit.jupiter.api.Test;

import java.util.HashMap;

public class OptionalTests {

    @Test
    public void testSignalsFunctionWithOptionals() throws InvalidInfraException {
        var infra = getBaseInfra("tiny_infra/infra_optional.json");
        assert infra != null;
        var config = getBaseConfig("tiny_infra/config_railjson_optional.json");
        assert config != null;

        // We force a (very long) switch change, to make sure signals are necessary
        infra.routes.forEach((route) -> {
            var positions = route.switchesPosition;
            positions.replaceAll((k, v) -> RJSSwitch.Position.RIGHT);
        });
        infra.switches.iterator().next().positionChangeDelay = 42;

        var sim = Simulation.createFromInfra(RailJSONParser.parse(infra), 0, null);
        run(sim, config);
    }

    @Test
    public void testSignalsFunctionWithOptionalsForcedGreen() throws InvalidInfraException {
        // Other half the test above: we check that invalid signals would have failed
        var infra = getBaseInfra("tiny_infra/infra_optional.json");
        assert infra != null;
        var config = getBaseConfig("tiny_infra/config_railjson_optional.json");
        assert config != null;

        var functions = infra.scriptFunctions;
        var aspect = new RJSRSExpr.AspectSet.AspectSetMember(
                new ID<>("GREEN"),
                new RJSRSExpr.True());
        for (var f : functions) {
            f.body = new RJSRSExpr.AspectSet(new RJSRSExpr.AspectSet.AspectSetMember[]{aspect});
        }
        infra.routes.forEach((route) -> {
            var positions = route.switchesPosition;
            positions.replaceAll((k, v) -> RJSSwitch.Position.RIGHT);
        });
        infra.switches.iterator().next().positionChangeDelay = 42;

        var sim = Simulation.createFromInfra(RailJSONParser.parse(infra), 0, null);
        assertThrows(SimulationError.class,
                () -> runWithExceptions(sim, config),
                "Expected a simulation error once the train goes through the switch"
        );
    }

    @Test
    void testThrowOnInvalidDelay() throws InvalidInfraException {
        var infra = getBaseInfra("tiny_infra/infra_optional.json");
        assert infra != null;
        var sim = Simulation.createFromInfra(RailJSONParser.parse(infra), 0, null);
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
}
