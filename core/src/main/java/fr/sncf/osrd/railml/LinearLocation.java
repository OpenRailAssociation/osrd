package fr.sncf.osrd.railml;

import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.railml.tracksectiongraph.NetElement;
import fr.sncf.osrd.railml.tracksectiongraph.TrackNetElement;
import fr.sncf.osrd.utils.graph.ApplicableDirection;
import org.dom4j.Element;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.util.Iterator;
import java.util.Map;

/**
 * <p>A class for linearLocation parsing.</p>
 *
 * <p>It can parse linear locations on both micro and macro element,
 * but only supports associatedNetElement.</p>
 *
 * <pre>
 * {@code
 * <linearLocation id="xxx" applicationDirection="reverse">
 *   <associatedNetElement netElementRef="ne.a" keepsOrientation="true">
 *     <linearCoordinateBegin positioningSystemRef="lps" measure="4400.0"/>
 *     <linearCoordinateEnd positioningSystemRef="lps" measure="4300.0"/>
 *   </associatedNetElement>
 *   <associatedNetElement netElementRef="ne.b" keepsOrientation="true">
 *     <linearCoordinateBegin positioningSystemRef="lps" measure="4300.0"/>
 *     <linearCoordinateEnd positioningSystemRef="lps" measure="700.0"/>
 *   </associatedNetElement>
 * </linearLocation>
 * }
 * </pre>
 */
public final class LinearLocation {
    static final Logger logger = LoggerFactory.getLogger(LinearLocation.class);

    public interface LinearLocationCallback {
        void acceptLocation(TrackNetElement element, ApplicableDirection direction, double begin, double end);
    }

    static ApplicableDirection mergeApplicationDirection(
            Element element,
            ApplicableDirection linearLocationDirection
    ) {
        var keepsOrientation = Boolean.parseBoolean(element.attributeValue("keepsOrientation"));
        if (keepsOrientation)
            return linearLocationDirection;
        return linearLocationDirection.opposite();
    }

    static boolean parse(
            LinearLocationCallback callback,
            Map<String, NetElement> netElementMap,
            Element rootNode
    ) throws InvalidInfraException {
        // get the linear location child
        var linearLocationElement = rootNode.element("linearLocation");
        if (linearLocationElement == null)
            return false;

        // parse the direction of the linearLocation
        var linearLocationDirection = ParsingUtils.parseApplicationDirection(linearLocationElement);

        // for all associatedNetElement
        for (Iterator<Element> it = linearLocationElement.elementIterator(); it.hasNext(); ) {
            Element associatedNetElement = it.next();
            var elementName = associatedNetElement.getName();
            if (!elementName.equals("associatedNetElement"))
                throw new InvalidInfraException("only associatedNetElement is supported within linearLocation");

            // get the ID of the netElement this is a reference to
            var netElementRef = associatedNetElement.attributeValue("netElementRef");
            var netElement = netElementMap.get(netElementRef);

            // compute the orientation of the element relative to the linear location
            var applicationDirection = mergeApplicationDirection(associatedNetElement, linearLocationDirection);

            // parse linear coordinates
            var beginCoord = associatedNetElement.element("linearCoordinateBegin");
            var endCoord = associatedNetElement.element("linearCoordinateEnd");

            var lrsBegin = beginCoord.attributeValue("positioningSystemRef");
            var lrsEnd = endCoord.attributeValue("positioningSystemRef");
            if (!lrsBegin.equals(lrsEnd))
                throw new InvalidInfraException("linearCoordinateBegin and linearCoordinateEnd aren't in the same LRS");

            // depending on the direction of the speed limit, the low and high lrs range values aren't the same
            double minMeasure;
            double maxMeasure;
            {
                double measureBegin = Double.parseDouble(beginCoord.attributeValue("measure"));
                double measureEnd = Double.parseDouble(endCoord.attributeValue("measure"));
                if (measureBegin < measureEnd) {
                    minMeasure = measureBegin;
                    maxMeasure = measureEnd;
                } else {
                    minMeasure = measureEnd;
                    maxMeasure = measureBegin;
                }
            }

            // find the TopoEdges the netElement spans over, and add the speed limit
            netElement.resolve(
                    (element, begin, end) -> callback.acceptLocation(element, applicationDirection, begin, end),
                    lrsBegin,
                    minMeasure,
                    maxMeasure
            );
        }
        return true;
    }
}
