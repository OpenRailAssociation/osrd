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

    public String toString() {
        switch (this) {
            case BOOLEAN:
                return "bool";
            case ASPECT_SET:
                return "AspectSet";
            case SIGNAL:
                return "Signal";
            case ROUTE:
                return "Route";
            case SWITCH:
                return "Switch";
            case OPTIONAL:
                return String.format("Optional<%s>", optionalContentType);
            default:
                return "";
        }
    }
}
