package fr.sncf.osrd.railml;

import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.railjson.schema.common.ID;
import fr.sncf.osrd.railjson.schema.infra.RJSOperationalPoint;
import fr.sncf.osrd.railjson.schema.infra.RJSTrackSection;
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSOperationalPointPart;
import fr.sncf.osrd.railml.tracksectiongraph.NetElement;
import org.dom4j.Document;
import org.dom4j.Element;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;

public final class RMLOperationalPoint {
    static ArrayList<RJSOperationalPoint> parse(
            Map<String, NetElement> netElementMap,
            Document document,
            HashMap<String, RJSTrackSection> rjsTrackSections
    ) throws InvalidInfraException {
        var res = new ArrayList<RJSOperationalPoint>();
        var xpath = "/railML/infrastructure/functionalInfrastructure/operationalPoints/operationalPoint";
        for (var operationalPointNode : document.selectNodes(xpath)) {
            var operationalPoint = (Element) operationalPointNode;

            // create the operational point
            var id = operationalPoint.attributeValue("id");
            var rjsOperationalPoint = new RJSOperationalPoint(id);
            var operationalPointID = ID.from(rjsOperationalPoint);
            res.add(rjsOperationalPoint);

            // link tracks sections back to the operational point
            var hasSpotLocation = SpotLocation.parse(
                    (netElement, appliesTo, pos) -> {
                        var rjsTrackSection = rjsTrackSections.get(netElement.id);
                        var opPart = new RJSOperationalPointPart(operationalPointID, pos);
                        rjsTrackSection.operationalPoints.add(opPart);
                    },
                    netElementMap,
                    operationalPoint
            );

            var hasLinearLocation = LinearLocation.parse(
                    (netElement, appliesTo, begin, end) -> {
                        var rjsTrackSection = rjsTrackSections.get(netElement.id);

                        // We don't support range operational point, se we get the middle point
                        var location = (begin + end) / 2;
                        var opPart = new RJSOperationalPointPart(operationalPointID, location);
                        rjsTrackSection.operationalPoints.add(opPart);
                    },
                    netElementMap,
                    operationalPoint
            );

            if (!hasLinearLocation && !hasSpotLocation)
                throw new InvalidInfraException(String.format("operationalPoint has no location: %s", id));
        }
        return res;
    }
}
