package fr.sncf.osrd.infra.parsing.railjson.schema;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;

@SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
public class OperationalPoint implements Identified {
    public final String id;

    public OperationalPoint(String id) {
        this.id = id;
    }

    @Override
    public String getID() {
        return id;
    }
}
