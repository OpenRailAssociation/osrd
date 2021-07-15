package fr.sncf.osrd.railjson.schema.successiontable;

import com.squareup.moshi.Json;

public class RJSSuccessionTable {
    /** The switch identifier */
    @Json(name = "switch")
    public String switchID;

    /** The succession table, an ordered list of trains identifiers */
    @Json(name = "table")
    public String[] table;

    /** Creates a new succesion table */
    public RJSSuccessionTable(
            String switchId,
            String[] table
    ) {
        this.switchID = switchId;
        this.table = table;
    }

    /** Creates an empty succesion table */
    public RJSSuccessionTable() {
        this.switchID = null;
        this.table = new String[0];
    }
}
