package fr.sncf.osrd.infra.parsing.railjson.schema;

public class RJSSpeedSection implements Identified {
    public final String id;

    public RJSSpeedSection(String id) {
        this.id = id;
    }

    @Override
    public String getID() {
        return id;
    }
}
