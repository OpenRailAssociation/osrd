package fr.sncf.osrd.railml;

import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.railjson.schema.common.ID;
import fr.sncf.osrd.railjson.schema.infra.RJSTrackSection;
import fr.sncf.osrd.railml.tracksectiongraph.NetElement;
import fr.sncf.osrd.utils.FloatCompare;
import fr.sncf.osrd.utils.graph.ApplicableDirection;
import fr.sncf.osrd.utils.graph.EdgeEndpoint;
import org.dom4j.Element;
import java.util.Locale;
import java.util.Map;

public class ParsingUtils {
    static ApplicableDirection parseNavigability(Element element) {
        var navigabilityStr = element.attributeValue("navigability").toUpperCase(Locale.ENGLISH);
        return ApplicableDirection.valueOf(navigabilityStr);
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
    static ApplicableDirection parseApplicationDirection(Element element) throws InvalidInfraException {
        var directionString = element.attributeValue("applicationDirection");
        if (directionString == null)
            return ApplicableDirection.BOTH;

        try {
            return ApplicableDirection.valueOf(directionString.toUpperCase(Locale.ENGLISH));
        } catch (IllegalArgumentException e) {
            throw new InvalidInfraException(String.format("invalid applicationDirection: %s", directionString));
        }
    }
}
