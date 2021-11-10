package fr.sncf.osrd.railjson.schema.successiontable;

import com.squareup.moshi.Json;

public class RJSTrainSuccessionTable {
    /** The switch identifier */
    @Json(name = "switch")
    public String switchID;

    /** The succession table, an ordered list of trains identifiers */
    @Json(name = "train_order")
    public String[] trainOrder;

    /** Creates a new succesion table */
    public RJSTrainSuccessionTable(
            String switchId,
            String[] trainOrder
    ) {
        this.switchID = switchId;
        this.trainOrder = trainOrder;
    }
}
