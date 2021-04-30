package fr.sncf.osrd.infra.railscript.value;

import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.infra_state.RouteStatus;
import fr.sncf.osrd.infra.trackgraph.SwitchPosition;

public enum RSType {
    BOOLEAN(null),
    ASPECT_SET(null),
    SIGNAL(null),
    ROUTE(RouteStatus.class),
    OPTIONAL_SIGNAL(null),
    OPTIONAL_ROUTE(null),
    SWITCH(SwitchPosition.class);

    public final Class<? extends Enum<?>> enumClass;

    RSType(Class<? extends Enum<?>> enumClass) {
        this.enumClass = enumClass;
    }

    /** Converts the value to the matching string */
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
            case OPTIONAL_ROUTE:
                return "Optional route";
            case OPTIONAL_SIGNAL:
                return "Optional signal";
            default:
                return "";
        }
    }

    /** Returns the subtype if this is an optional */
    public RSType subType() throws InvalidInfraException {
        switch (this) {
            case OPTIONAL_ROUTE:
                return ROUTE;
            case OPTIONAL_SIGNAL:
                return SIGNAL;
        }
        throw new InvalidInfraException("Can't call subtype on a type that is not an optional");
    }
}
