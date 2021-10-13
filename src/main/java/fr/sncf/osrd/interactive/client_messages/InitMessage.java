package fr.sncf.osrd.interactive.client_messages;

import com.squareup.moshi.Json;
import fr.sncf.osrd.interactive.InteractiveSimulation;
import fr.sncf.osrd.railjson.schema.infra.RJSInfra;
import fr.sncf.osrd.railjson.schema.rollingstock.RJSRollingStock;
import java.io.IOException;
import java.util.Collection;

public final class InitMessage extends ClientMessage {
    public RJSInfra infra = null;
    @Json(name = "extra_rolling_stocks")
    public Collection<RJSRollingStock> extraRollingStocks = null;

    @Override
    public void run(InteractiveSimulation interactiveSimulation) throws IOException {
        interactiveSimulation.init(infra, extraRollingStocks);
    }
}
