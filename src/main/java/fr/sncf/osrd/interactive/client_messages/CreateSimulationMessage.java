package fr.sncf.osrd.interactive.client_messages;

import com.squareup.moshi.Json;
import fr.sncf.osrd.interactive.InteractiveSimulation;
import fr.sncf.osrd.interactive.ServerError;
import fr.sncf.osrd.interactive.ServerMessage;
import fr.sncf.osrd.railjson.schema.rollingstock.RJSRollingStock;
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainSchedule;
import fr.sncf.osrd.railjson.schema.successiontable.RJSSuccessionTable;

import java.util.List;

public class CreateSimulationMessage extends ClientMessage {
    @Json(name = "train_schedules")
    public List<RJSTrainSchedule> trainSchedules;

    @Json(name = "rolling_stocks")
    public List<RJSRollingStock> rollingStocks;

    @Json(name = "successions")
    public List<RJSSuccessionTable> successions;

    @Override
    public ServerMessage run(InteractiveSimulation interactiveSimulation) throws ServerError {
        return interactiveSimulation.createSimulation(trainSchedules, rollingStocks, successions);
    }
}
