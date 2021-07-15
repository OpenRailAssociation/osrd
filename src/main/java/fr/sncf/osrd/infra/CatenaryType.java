package fr.sncf.osrd.infra;


public class CatenaryType {
    /**
     * dividing the infra to get the electrical profiles
     */
    public final String type;

    public final double voltage;

    public CatenaryType(String type, double voltage) {
        this.type = type;
        this.voltage = voltage;
    }
}



