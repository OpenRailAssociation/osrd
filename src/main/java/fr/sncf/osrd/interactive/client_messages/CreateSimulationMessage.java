package fr.sncf.osrd.interactive.client_messages;

import com.squareup.moshi.Json;
import fr.sncf.osrd.interactive.InteractiveSimulation;
import fr.sncf.osrd.railjson.schema.rollingstock.RJSRollingStock;
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainSchedule;
import fr.sncf.osrd.railjson.schema.successiontable.RJSSuccessionTable;

import java.io.IOException;
import java.util.List;

public class CreateSimulationMessage extends ClientMessage {
    @Json(name = "train_schedules")
    public List<RJSTrainSchedule> trainSchedules;

    @Json(name = "rolling_stocks")
    public List<RJSRollingStock> rollingStocks;

    @Json(name = "successions")
    public List<RJSSuccessionTable> successions;

    @Override
    public void run(InteractiveSimulation interactiveSimulation) throws IOException {
        interactiveSimulation.createSimulation(trainSchedules, rollingStocks, successions);
    }
}
