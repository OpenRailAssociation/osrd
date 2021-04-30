package fr.sncf.osrd.infra.railscript.value;

import fr.sncf.osrd.infra_state.RouteStatus;
import fr.sncf.osrd.infra.trackgraph.SwitchPosition;

public enum RSType {
    BOOLEAN(null),
    ASPECT_SET(null),
    SIGNAL(null),
    ROUTE(RouteStatus.class),
    OPTIONAL(null),
    SWITCH(SwitchPosition.class);

    public final Class<? extends Enum<?>> enumClass;
    public RSType optionalContentType = null;

    RSType(Class<? extends Enum<?>> enumClass) {
        this.enumClass = enumClass;
    }
}
