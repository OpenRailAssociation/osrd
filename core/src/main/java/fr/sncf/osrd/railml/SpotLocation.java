package fr.sncf.osrd.railml;

import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.railml.tracksectiongraph.NetElement;
import fr.sncf.osrd.railml.tracksectiongraph.TrackNetElement;
import fr.sncf.osrd.utils.graph.ApplicableDirection;
import org.dom4j.Element;
import java.util.Map;

/**
 * There are two types of SpotLocations:
 *  - when it has a "pos" attribute, the referenced netElement is a microscopic netElement
 *  - otherwise, it's a macro / meso netElement, and the linearCoordinate matters
 *
 * <pre>
 * {@code
 * <spotLocation id="xxx" netElementRef="ne" applicationDirection="reverse" pos="0.0">
 *   <!-- optional, as there's already an edge position above -->
 *   <linearCoordinate positioningSystemRef="lps01" measure="0.0"/>
 * </spotLocation>
 * }
 * </pre>
 */
public final class SpotLocation {
    public final TrackNetElement netElement;
    public final ApplicableDirection appliesTo;
    public final double position;

    SpotLocation(
            TrackNetElement netElement,
            ApplicableDirection appliesTo,
            double position
    ) {
        this.netElement = netElement;
        this.appliesTo = appliesTo;
        this.position = position;
    }

    static SpotLocation parseSingle(
            Map<String, NetElement> netElements,
            Element rootElement
    ) throws InvalidInfraException {
        var spotLocationElement = rootElement.element("spotLocation");
        if (spotLocationElement == null)
            return null;

        var netElementId = spotLocationElement.attributeValue("netElementRef");
        var applicationDirection = ParsingUtils.parseApplicationDirection(spotLocationElement);

        var netElement = netElements.get(netElementId);

        if (netElement == null)
            throw new InvalidInfraException(String.format("unknown netElement: %s", netElementId));

        if (netElement.getClass() != TrackNetElement.class)
            throw new InvalidInfraException(String.format(
                    "a single spot location references a macro / meso netElement: %s", netElementId));

        var trackNetElement = (TrackNetElement) netElement;

        var posStr = spotLocationElement.attributeValue("pos");
        if (posStr != null)
            return new SpotLocation(trackNetElement, applicationDirection, Double.parseDouble(posStr));

        // if there is not pos attribute, it must be located using a linear coordinate
        var linearCoordinateElement = spotLocationElement.element("linearCoordinate");
        if (linearCoordinateElement == null)
            throw new InvalidInfraException(String.format(
                    "spotLocation %s has no pos nor linearCoordinate", spotLocationElement.attributeValue("id")));

        // parse the content of the linearCoordinate
        var positioningSystemRef = linearCoordinateElement.attributeValue("positioningSystemRef");
        var pos = Double.parseDouble(linearCoordinateElement.attributeValue("measure"));

        var location = trackNetElement.resolveSingle(positioningSystemRef, pos);
        if (Double.isNaN(location))
            throw new InvalidInfraException(
                    "the edge of the spotLocation isn't positioned in its linearCoordinate positioning system");
        return new SpotLocation(trackNetElement, applicationDirection, location);
    }

    public interface SpotLocationCallback {
        void acceptLocation(TrackNetElement netElement, ApplicableDirection appliesTo, double pos);
    }

    static boolean parse(
            SpotLocationCallback callback,
            Map<String, NetElement> netElements,
            Element rootElement
    ) throws InvalidInfraException {
        var spotLocationElement = rootElement.element("spotLocation");
        if (spotLocationElement == null)
            return false;

        // parse the referenced netElement
        var netElementId = spotLocationElement.attributeValue("netElementRef");
        var netElement = netElements.get(netElementId);

        if (netElement == null)
            throw new InvalidInfraException(String.format("unknown netElement: %s", netElementId));

        var applicationDirection = ParsingUtils.parseApplicationDirection(spotLocationElement);

        var posStr = spotLocationElement.attributeValue("pos");

        // if there's a position field, the referenced netElement must be a TrackNetElement
        // thus, this SpotLocation only references a single location
        if (posStr != null) {
            var pos = Double.parseDouble(posStr);
            if (netElement.getClass() != TrackNetElement.class)
                throw new InvalidInfraException(String.format(
                        "SpotLocation has a pos attribute but doesn't reference a micro netElement: %s", netElementId));
            var trackNetElement = (TrackNetElement) netElement;
            callback.acceptLocation(trackNetElement, applicationDirection, pos);
            return true;
        }

        // otherwise, this may be a meso / macro netElement reference, which can map to multiple locations
        var linearCoordinateElement = spotLocationElement.element("linearCoordinate");
        if (linearCoordinateElement == null)
            throw new InvalidInfraException(String.format(
                    "spotLocation %s has no pos nor linearCoordinate", spotLocationElement.attributeValue("id")));

        // parse the content of the linearCoordinate
        var positioningSystemRef = linearCoordinateElement.attributeValue("positioningSystemRef");
        var pos = Double.parseDouble(linearCoordinateElement.attributeValue("measure"));

        netElement.resolve(
                (element, position) -> callback.acceptLocation(element, applicationDirection, position),
                positioningSystemRef,
                pos
        );
        return true;
    }
}
