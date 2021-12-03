package fr.sncf.osrd.railml.tracksectiongraph;

import static fr.sncf.osrd.utils.graph.EdgeEndpoint.BEGIN;
import static fr.sncf.osrd.utils.graph.EdgeEndpoint.END;

import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.railjson.schema.common.ID;
import fr.sncf.osrd.railjson.schema.infra.RJSTrackSectionLink;
import fr.sncf.osrd.railml.DescriptionLevel;
import fr.sncf.osrd.utils.graph.ApplicableDirection;
import fr.sncf.osrd.utils.graph.EdgeDirection;
import fr.sncf.osrd.utils.graph.EdgeEndpoint;
import fr.sncf.osrd.utils.graph.IBiNeighborRel;
import org.dom4j.Document;
import org.dom4j.Element;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

public class NetRelation implements IBiNeighborRel<TrackNetElement> {

    public final ApplicableDirection navigability;
    public final EdgeEndpoint beginEndpoint;
    public final TrackNetElement begin;
    public final EdgeEndpoint endEndpoint;
    public final TrackNetElement end;

    protected NetRelation(
            ApplicableDirection navigability,
            TrackNetElement begin,
            EdgeEndpoint beginEndpoint,
            TrackNetElement end,
            EdgeEndpoint endEndpoint
    ) {
        this.navigability = navigability;
        this.beginEndpoint = beginEndpoint;
        this.endEndpoint = endEndpoint;
        this.begin = begin;
        this.end = end;
    }

    /** Converts a RailJSON trackSectionLink into NetRelation */
    public static NetRelation fromTrackSectionLink(
            RJSTrackSectionLink rjsTrackSectionLink,
            Map<String, NetElement> netElements
    ) throws InvalidInfraException {
        var begin = netElements.get(rjsTrackSectionLink.begin.section.id);
        var end = netElements.get(rjsTrackSectionLink.end.section.id);
        if (begin.getClass() != TrackNetElement.class || end.getClass() != TrackNetElement.class) {
            throw new InvalidInfraException("TrackSectionLink should link only TrackNetElement");
        }
        var beginTrack = (TrackNetElement) begin;
        var endTrack = (TrackNetElement) end;
        return new NetRelation(
                rjsTrackSectionLink.navigability,
                beginTrack,
                rjsTrackSectionLink.begin.endpoint,
                endTrack,
                rjsTrackSectionLink.end.endpoint
        );
    }

    /** Parse a RailML intrinsicCoord */
    public static EdgeEndpoint parseCoord(String intrinsicCoord) {
        assert intrinsicCoord.equals("0") || intrinsicCoord.equals("1");
        if (intrinsicCoord.equals("0"))
            return BEGIN;
        return END;
    }

    public static EndpointID parseEndpoint(String elementID, String position) {
        return new EndpointID(new ID<>(elementID), parseCoord(position));
    }

    static RJSTrackSectionLink from(
            ApplicableDirection navigability,
            String positionOnA,
            String elementA,
            String positionOnB,
            String elementB
    ) {
        return new RJSTrackSectionLink(
                navigability,
                parseEndpoint(elementA, positionOnA),
                parseEndpoint(elementB, positionOnB)
        );
    }

    /** Parse all netRelations in a RailML document */
    public static Map<String, RJSTrackSectionLink> parse(Map<String, DescriptionLevel> descLevels, Document document) {
        var netRelations = new HashMap<String, RJSTrackSectionLink>();

        for (var netRelationNode : document.selectNodes("/railML/infrastructure/topology/netRelations/netRelation")) {
            var netRelation = (Element) netRelationNode;
            var navigabilityStr = netRelation.attributeValue("navigability").toUpperCase(Locale.ENGLISH);
            if (navigabilityStr.equals("NONE"))
                continue;

            var navigability = ApplicableDirection.valueOf(navigabilityStr);

            var id = netRelation.attributeValue("id");
            if (descLevels.get(id) != DescriptionLevel.MICRO)
                continue;

            var positionOnA = netRelation.attributeValue("positionOnA");
            var elementA = netRelation.valueOf("elementA/@ref");

            var positionOnB = netRelation.attributeValue("positionOnB");
            var elementB = netRelation.valueOf("elementB/@ref");

            netRelations.put(id, NetRelation.from(navigability, positionOnA, elementA, positionOnB, elementB));
        }
        return netRelations;
    }

    @Override
    public TrackNetElement getEdge(TrackNetElement originEdge, EdgeDirection direction) {
        if (originEdge == begin)
            return end;
        return begin;
    }

    @Override
    public EdgeDirection getDirection(TrackNetElement originEdge, EdgeDirection direction) {
        if (originEdge == begin)
            return endEndpoint == BEGIN ? EdgeDirection.START_TO_STOP : EdgeDirection.STOP_TO_START;
        return beginEndpoint == BEGIN ? EdgeDirection.START_TO_STOP : EdgeDirection.STOP_TO_START;
    }

    @Override
    public boolean isBidirectional() {
        return navigability == ApplicableDirection.BOTH;
    }
}
