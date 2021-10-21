package fr.sncf.osrd.interactive.client_messages;

import com.squareup.moshi.Json;
import fr.sncf.osrd.interactive.InteractiveSimulation;
import fr.sncf.osrd.railjson.schema.successiontable.RJSTrainSuccessionTable;
import java.io.IOException;
import java.util.List;

public class UpdateTrainSuccessionTablesMessage extends ClientMessage {
    @Json(name = "train_succession_tables")
    public List<RJSTrainSuccessionTable> trainSuccessionTables;

    @Override
    public void run(InteractiveSimulation interactiveSimulation) throws IOException {
        interactiveSimulation.updateTrainSuccessionTable(trainSuccessionTables);
    }
}
