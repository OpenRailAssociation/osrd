package fr.sncf.osrd.railjson.schema.infra;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.railjson.schema.common.Identified;

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
