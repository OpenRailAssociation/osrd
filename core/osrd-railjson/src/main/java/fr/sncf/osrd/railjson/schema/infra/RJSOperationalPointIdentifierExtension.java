package fr.sncf.osrd.railjson.schema.infra;

public class RJSOperationalPointIdentifierExtension {
    public String name;
    public long uic;

    public RJSOperationalPointIdentifierExtension(String name, long uic) {
        this.name = name;
        this.uic = uic;
    }
}
