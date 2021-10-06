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
    public ArrayList<String> trainOrderedList;

    /** Creates a new succession table */
    public SuccessionTable(String switchID, ArrayList<String> trainOrderedList) {
        this.switchID = switchID;
        this.trainOrderedList = trainOrderedList;
    }

    public SuccessionTable(SuccessionTable st) {
        this.switchID = st.switchID;
        this.trainOrderedList = new ArrayList<>(st.trainOrderedList);
    }

    public void add(String trainID) {
        trainOrderedList.add(trainID);
    }

    public String get(int index) {
        return trainOrderedList.get(index);
    }
}
