package fr.sncf.osrd.infra.railjson.schema.signaling;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.railjson.schema.Identified;

@SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
public class RJSAspect implements Identified {
    public final String id;

    public RJSAspect(String id) {
        this.id = id;
    }

    @Override
    public String getID() {
        return id;
    }
}
