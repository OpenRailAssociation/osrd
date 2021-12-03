package fr.sncf.osrd.interactive.client_messages;

import com.squareup.moshi.JsonAdapter;
import com.squareup.moshi.Moshi;
import com.squareup.moshi.adapters.PolymorphicJsonAdapterFactory;
import fr.sncf.osrd.interactive.InteractiveSimulation;
import fr.sncf.osrd.railjson.schema.common.ID;
import fr.sncf.osrd.railjson.schema.infra.railscript.RJSRSExpr;
import fr.sncf.osrd.railjson.schema.infra.signaling.RJSAspectConstraint;
import fr.sncf.osrd.railjson.schema.infra.trackobjects.RJSRouteWaypoint;
import fr.sncf.osrd.railjson.schema.rollingstock.RJSRollingResistance;
import fr.sncf.osrd.railjson.schema.rollingstock.RJSRollingStock;
import fr.sncf.osrd.railjson.schema.schedule.RJSAllowance;
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainPhase;
import java.io.IOException;

public abstract class ClientMessage {
    public static final JsonAdapter<ClientMessage> adapter = new Moshi.Builder()
                .add(PolymorphicJsonAdapterFactory.of(ClientMessage.class, "message_type")
                        .withSubtype(InitMessage.class, "init")
                        .withSubtype(CreateSimulationMessage.class, "create_simulation")
                        .withSubtype(WatchChangesMessage.class, "watch_changes")
                        .withSubtype(RunUntilMessage.class, "run")
                        .withSubtype(GetTrainDelaysMessage.class, "get_train_delays")
                        .withSubtype(GetTrainSuccessionTablesMessage.class, "get_train_succession_tables")
                        .withSubtype(UpdateTrainSuccessionTablesMessage.class, "update_train_succession_tables")
                )
                // for RJSInfra
                .add(ID.Adapter.FACTORY)
                .add(RJSRSExpr.adapter)
                .add(RJSAspectConstraint.adapter)
                // for RJSRollingStock
                .add(RJSRollingResistance.adapter)
                .add(RJSRollingStock.RJSMode.adapter)
                // for RJSTrainSchedule
                .add(RJSTrainPhase.adapter)
                .add(RJSAllowance.adapter)
                .build()
                .adapter(ClientMessage.class);

    public abstract void run(InteractiveSimulation interactiveSimulation) throws IOException;
}
