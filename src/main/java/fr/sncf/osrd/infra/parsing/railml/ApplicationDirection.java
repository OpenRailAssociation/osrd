package fr.sncf.osrd.infra.parsing.railml;

import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.infra.graph.EdgeDirection;

import java.util.Locale;

public enum ApplicationDirection {
    NORMAL(new EdgeDirection[]{EdgeDirection.START_TO_STOP}),
    REVERSE(new EdgeDirection[]{EdgeDirection.STOP_TO_START}),
    BOTH(new EdgeDirection[]{EdgeDirection.START_TO_STOP, EdgeDirection.STOP_TO_START});

    public final EdgeDirection[] directionSet;

    ApplicationDirection(EdgeDirection[] directionSet) {
        this.directionSet = directionSet;
    }

    /**
     * Parses an applicationDirection into a list of EdgeDirection its valid for
     * @param str the string to parse
     * @return the list of edge directions the applicationDirection is valid for
     */
    public static ApplicationDirection parse(String str) throws InvalidInfraException {
        try {
            return ApplicationDirection.valueOf(str.toUpperCase(Locale.ENGLISH));
        } catch (IllegalArgumentException e) {
            throw new InvalidInfraException(String.format("invalid applicationDirection: %s", str));
        }
    }
}
