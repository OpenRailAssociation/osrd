package fr.sncf.osrd.interactive.client_messages;

import com.squareup.moshi.Json;
import fr.sncf.osrd.interactive.InteractiveSimulation;
import fr.sncf.osrd.interactive.ServerError;
import fr.sncf.osrd.interactive.ServerMessage;
import fr.sncf.osrd.railjson.schema.infra.RJSInfra;
import fr.sncf.osrd.railjson.schema.rollingstock.RJSRollingStock;

import java.util.Collection;

public final class InitMessage extends ClientMessage {
    public RJSInfra infra = null;
    @Json(name = "extra_rolling_stocks")
    public Collection<RJSRollingStock> extraRollingStocks = null;

    @Override
    public ServerMessage run(InteractiveSimulation interactiveSimulation) throws ServerError {
        return interactiveSimulation.init(infra, extraRollingStocks);
    }
}
