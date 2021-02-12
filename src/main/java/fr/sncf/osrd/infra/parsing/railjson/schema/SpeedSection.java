package fr.sncf.osrd.infra.parsing.railjson.schema;

public class SpeedSection implements Identified {
    public final String id;

    public SpeedSection(String id) {
        this.id = id;
    }

    @Override
    public String getID() {
        return id;
    }
}
