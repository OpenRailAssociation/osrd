package fr.sncf.osrd.interactive;

import fr.sncf.osrd.RollingStock;
import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.railjson.parser.RJSRollingStockParser;
import fr.sncf.osrd.railjson.parser.RailJSONParser;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidRollingStock;
import fr.sncf.osrd.railjson.schema.infra.RJSInfra;
import fr.sncf.osrd.railjson.schema.rollingstock.RJSRollingStock;

import java.util.Collection;
import java.util.HashMap;
import java.util.Map;
import java.util.TreeMap;

public class InteractiveSimulation {
    private Infra infra = null;
    private Map<String, RollingStock> extraRollingStocks = new HashMap<>();
    private SessionState state = SessionState.UNINITIALIZED;

    private void checkState(SessionState expectedState) throws ServerError {
        if (this.state == expectedState)
            return;

        var details = new TreeMap<String, String>();
        details.put("expected", expectedState.name());
        details.put("got", this.state.name());
        var message = new ServerMessage.Error("unexpected session state", details);
        throw new ServerError(message);
    }

    public ServerMessage init(RJSInfra rjsInfra, Collection<RJSRollingStock> extraRJSRollingStocks) throws ServerError {
        checkState(SessionState.UNINITIALIZED);

        try {
            var infra = RailJSONParser.parse(rjsInfra);
            for (var rjsRollingStock : extraRJSRollingStocks) {
                var rollingStock = RJSRollingStockParser.parse(rjsRollingStock);
                extraRollingStocks.put(rollingStock.id, rollingStock);
            }
            this.infra = infra;
            return new ServerMessage.SessionInitialized();
        } catch (InvalidInfraException e) {
            return ServerMessage.Error.withReason("failed to parse infra", e.getMessage());
        } catch (InvalidRollingStock e) {
            return ServerMessage.Error.withReason("failed to parse rolling stocks", e.getMessage());
        }
    }
}
