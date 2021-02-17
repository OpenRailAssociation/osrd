package fr.sncf.osrd.infra.parsing.railml;

import static fr.sncf.osrd.infra.graph.EdgeEndpoint.*;

import fr.sncf.osrd.infra.graph.EdgeEndpoint;
import fr.sncf.osrd.infra.graph.ApplicableDirections;
import fr.sncf.osrd.infra.parsing.railjson.schema.ID;
import fr.sncf.osrd.infra.parsing.railjson.schema.RJSTrackSection.EndpointID;
import fr.sncf.osrd.infra.parsing.railjson.schema.RJSTrackSectionLink;
import org.dom4j.Document;
import org.dom4j.Element;

import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

abstract class NetRelation {
    public static EdgeEndpoint parseCoord(String intrinsicCoord) {
        assert intrinsicCoord.equals("0") || intrinsicCoord.equals("1");
        if (intrinsicCoord.equals("0"))
            return BEGIN;
        return END;
    }

    public static EndpointID parseEndpoint(String elementID, String position) {
        return new EndpointID(new ID<>(elementID), parseCoord(position));
    }

    public static RJSTrackSectionLink parse(
            ApplicableDirections navigability,
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

    static Map<String, RJSTrackSectionLink> parse(Map<String, DescriptionLevel> descLevels, Document document) {
        var netRelations = new HashMap<String, RJSTrackSectionLink>();

        for (var netRelationNode : document.selectNodes("/railML/infrastructure/topology/netRelations/netRelation")) {
            var netRelation = (Element) netRelationNode;
            var navigabilityStr = netRelation.attributeValue("navigability").toUpperCase(Locale.ENGLISH);
            if (navigabilityStr.equals("NONE"))
                continue;

            var navigability = ApplicableDirections.valueOf(navigabilityStr);

            var id = netRelation.attributeValue("id");
            if (descLevels.get(id) != DescriptionLevel.MICRO)
                continue;

            var positionOnA = netRelation.attributeValue("positionOnA");
            var elementA = netRelation.valueOf("elementA/@ref");

            var positionOnB = netRelation.attributeValue("positionOnB");
            var elementB = netRelation.valueOf("elementB/@ref");

            netRelations.put(id, NetRelation.parse(navigability, positionOnA, elementA, positionOnB, elementB));
        }
        return netRelations;
    }
}
