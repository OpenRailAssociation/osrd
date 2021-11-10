package fr.sncf.osrd.railml.tracksectiongraph;

import fr.sncf.osrd.railml.DescriptionLevel;
import fr.sncf.osrd.utils.PointValue;
import fr.sncf.osrd.utils.RangeValue;
import fr.sncf.osrd.utils.graph.Edge;
import fr.sncf.osrd.utils.graph.EdgeEndpoint;
import org.dom4j.Document;
import org.dom4j.Element;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;

public abstract class NetElement extends Edge {
    static final Logger logger = LoggerFactory.getLogger(NetElement.class);

    public final String id;

    /** The start position of the netElement in a set of linear reference systems. */
    final Map<String, Double> lrsStartOffsets;

    NetElement(int index, double length, String id, Map<String, Double> lrsStartOffsets) {
        super(index, length);
        this.lrsStartOffsets = lrsStartOffsets;
        this.id = id;
    }

    /**
     * Parses an associatedPositioningSystem
     *
     * <pre>
     * {@code
     * <netElement id="xxx" length="42.0">
     *   <relation ref="nr.a"/>
     *   <relation ref="nr.b"/>
     *   <associatedPositioningSystem id="xxx">
     *     <intrinsicCoordinate id="xxx" intrinsicCoord="0">
     *       <linearCoordinate positioningSystemRef="some_lps" measure="0.0"/>
     *     </intrinsicCoordinate>
     *     <intrinsicCoordinate id="xxx" intrinsicCoord="1">
     *       <linearCoordinate positioningSystemRef="some_lps" measure="500.0"/>
     *     </intrinsicCoordinate>
     *   </associatedPositioningSystem>
     * </netElement>
     * }
     * </pre>
     *
     * @param rootElement the XML element to parse the associatedPositioningSystem of
     * @return a map from positioning system ID to start offset
     */
    static Map<String, Double> parsePositioningSystem(Element rootElement) {
        var associatedPositioningSystem = rootElement.element("associatedPositioningSystem");
        if (associatedPositioningSystem == null)
            return null;

        var lrsStartOffsets = new HashMap<String, Double>();
        for (var intrinsicCoordElem: associatedPositioningSystem.elements("intrinsicCoordinate")) {
            // parse the intrinsicCoordinate
            var intrinsicCoord = NetRelation.parseCoord(intrinsicCoordElem.attributeValue("intrinsicCoord"));
            var linearCoordElem = intrinsicCoordElem.element("linearCoordinate");

            // the reference RailML file has this quirk
            // TODO: figure out if this is legit
            if (linearCoordElem == null) {
                logger.warn("intrinsicCoordElem {} has no linearCoordinate",
                        intrinsicCoordElem.attributeValue("id"));
                continue;
            }

            // parse the linearCoordinate
            var positioningSystemRef = linearCoordElem.attributeValue("positioningSystemRef");
            var measure = Double.parseDouble(linearCoordElem.attributeValue("measure"));

            // a preliminary export script had empty positioningSystemRefs
            assert !positioningSystemRef.isEmpty();

            // we only care about the starting point of the edge in the LRS.
            // this could definitely be improved on.
            if (intrinsicCoord == EdgeEndpoint.BEGIN)
                lrsStartOffsets.put(positioningSystemRef, measure);
        }

        return lrsStartOffsets;
    }

    /**
     * Parse pieces of tracks, linking those to nodes.
     * Nodes were detected using a connected component algorithm.
     */
    public static Map<String, NetElement> parse(
            Map<String, DescriptionLevel> descLevels,
            Document document,
            RMLTrackSectionGraph graph
    ) {
        var netElementMap = new HashMap<String, NetElement>();
        var xpath = "/railML/infrastructure/topology/netElements/netElement";
        var netElements = document.selectNodes(xpath);

        for (var netElementNode : netElements) {
            var netElement = (Element) netElementNode;
            var id = netElement.attributeValue("id");
            if (descLevels.get(id) != DescriptionLevel.MICRO)
                continue;

            // create the edge corresponding to the track section
            var lengthStr = netElement.attributeValue("length");
            double length = Double.parseDouble(lengthStr);
            var trackNetElement = TrackNetElement.parse(graph.nextEdgeIndex(), id, netElement, length);
            netElementMap.put(id, trackNetElement);
            graph.registerEdge(trackNetElement);
        }

        // we need to create meso elements after creating micro elements, so those already are registered
        for (var netElementNode : netElements) {
            var netElement = (Element) netElementNode;
            var id = netElement.attributeValue("id");
            var descLevel = descLevels.get(id);
            if (descLevel != DescriptionLevel.MESO)
                continue;
            netElementMap.put(id, GroupNetElement.parse(id, netElement, netElementMap));
        }

        // we need to create macro elements after creating meso elements, so those already are registered
        for (var netElementNode : netElements) {
            var netElement = (Element) netElementNode;
            var id = netElement.attributeValue("id");
            var descLevel = descLevels.get(id);
            if (descLevel != DescriptionLevel.MACRO)
                continue;
            netElementMap.put(id, GroupNetElement.parse(id, netElement, netElementMap));
        }
        return netElementMap;
    }

    public interface SpotLocationCallback {
        void acceptLocation(TrackNetElement element, double pos);
    }

    /** Gets points on netElements from a location in a LRS */
    public ArrayList<PointValue<TrackNetElement>> resolve(String lrsId, double measure) {
        var res = new ArrayList<PointValue<TrackNetElement>>();
        resolve((element, pos) -> res.add(new PointValue<>(pos, element)), lrsId, measure);
        return res;
    }

    public abstract void resolve(SpotLocationCallback callback, String lrsId, double measure);

    public interface RangeLocationCallback {
        void acceptLocation(TrackNetElement element, double begin, double end);
    }

    /** Gets ranges on netElements from a range in a LRS */
    public ArrayList<RangeValue<TrackNetElement>> resolve(String lrsId, double begin, double end) {
        var res = new ArrayList<RangeValue<TrackNetElement>>();
        resolve((element, _begin, _end) -> res.add(new RangeValue<>(_begin, _end, element)), lrsId, begin, end);
        return res;
    }

    public abstract void resolve(RangeLocationCallback callback, String lrsId, double begin, double end);
}
