package fr.sncf.osrd.infra.railjson.schema;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;

@SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
public class RJSOperationalPoint implements Identified {
    public final String id;

    public RJSOperationalPoint(String id) {
        this.id = id;
    }

    @Override
    public String getID() {
        return id;
    }
}
