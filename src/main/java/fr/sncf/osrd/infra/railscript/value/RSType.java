package fr.sncf.osrd.infra.railscript.value;

import fr.sncf.osrd.infra.routegraph.RouteStatus;
import fr.sncf.osrd.infra.trackgraph.SwitchPosition;

public enum RSType {
    BOOLEAN(null),
    ASPECT_SET(null),
    SIGNAL(null),
    ROUTE(RouteStatus.class),
    SWITCH(SwitchPosition.class);

    public final Class<? extends Enum<?>> enumClass;

    RSType(Class<? extends Enum<?>> enumClass) {
        this.enumClass = enumClass;
    }
}
