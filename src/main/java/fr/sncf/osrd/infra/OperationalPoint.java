package fr.sncf.osrd.infra;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;

@SuppressFBWarnings(
        value = "URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD",
        justification = "kept for later use"
)
public class OperationalPoint {
    public final String id;
    public final String name;

    public OperationalPoint(String id, String name) {
        this.id = id;
        this.name = name;
    }
}
