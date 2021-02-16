package fr.sncf.osrd.infra.parsing.railml;

import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.infra.graph.EdgeEndpoint;
import fr.sncf.osrd.infra.parsing.railjson.schema.ID;
import fr.sncf.osrd.infra.parsing.railjson.schema.ApplicableDirections;
import fr.sncf.osrd.infra.parsing.railjson.schema.RJSTrackSection;
import fr.sncf.osrd.util.FloatCompare;
import fr.sncf.osrd.util.PointValue;
import org.dom4j.Element;

import java.util.Locale;
import java.util.Map;

public class ParsingUtils {
    static ApplicableDirections parseNavigability(Element element) {
        var navigabilityStr = element.attributeValue("navigability").toUpperCase(Locale.ENGLISH);
        return ApplicableDirections.valueOf(navigabilityStr);
    }


    private static EdgeEndpoint parseEdgeEndpoint(SpotLocation location) throws InvalidInfraException {
        if (location.position == 0.0)
            return EdgeEndpoint.BEGIN;
        if (FloatCompare.eq(location.position, location.netElement.length))
            return EdgeEndpoint.END;

        throw new InvalidInfraException(String.format(
                "position %f isn't an endpoint of netElement %s",
                location.position, location.netElement.id));
    }

    static RJSTrackSection.EndpointID parseLocationEndpointID(
            Map<String, NetElement> netElements,
            Element element
    ) throws InvalidInfraException {
        var location = SpotLocation.parseSingle(netElements, element);
        var edgeEndpoint = parseEdgeEndpoint(location);
        return new RJSTrackSection.EndpointID(new ID<>(location.netElement.id), edgeEndpoint);
    }

    /**
     * Parses the application direction of an element. If there's none, default to both.
     *
     * @param element the element to parse the application direction of
     * @return the application direction
     * @throws InvalidInfraException {@inheritDoc}
     */
    static ApplicableDirections parseApplicationDirection(Element element) throws InvalidInfraException {
        var directionString = element.attributeValue("applicationDirection");
        if (directionString == null)
            return ApplicableDirections.BOTH;

        try {
            return ApplicableDirections.valueOf(directionString.toUpperCase(Locale.ENGLISH));
        } catch (IllegalArgumentException e) {
            throw new InvalidInfraException(String.format("invalid applicationDirection: %s", directionString));
        }
    }
}
