package fr.sncf.osrd.infra;

import java.util.ArrayList;

/**
 * The mutable succesion table for a switch (order of trains on that switch)
 * There must be a SuccesionTable instance per switch on the network.
 */

public class SuccessionTable {
    /** the switch identifier whose it is the succession table */
    public final String switchID;

    /** the table itself, an ordered list of trains identifier */
    public final ArrayList<String> table;

    /** Creates a new succession table */
    public SuccessionTable(String switchID, ArrayList<String> table) {
        this.switchID = switchID;
        this.table = table;
    }

    public SuccessionTable(SuccessionTable st) {
        this.switchID = st.switchID;
        this.table = new ArrayList<>(st.table);
    }

    public void add(String trainID) {
        table.add(trainID);
    }

    public String get(int index) {
        return table.get(index);
    }
}
