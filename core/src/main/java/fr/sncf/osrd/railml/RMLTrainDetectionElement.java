package fr.sncf.osrd.railml;

import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.railjson.schema.infra.RJSTrackSection;
import fr.sncf.osrd.railjson.schema.infra.trackobjects.RJSTrainDetector;
import fr.sncf.osrd.railml.tracksectiongraph.NetElement;
import fr.sncf.osrd.utils.graph.ApplicableDirection;
import org.dom4j.Document;
import org.dom4j.Element;
import java.util.HashMap;
import java.util.Map;

public class RMLTrainDetectionElement {
    static void parse(
            Map<String, NetElement> netElements,
            Document document,
            HashMap<String, RJSTrackSection> rjsTrackSections
    ) throws InvalidInfraException {
        var xpath = "/railML/infrastructure/functionalInfrastructure/trainDetectionElements/trainDetectionElement";
        for (var trainDetectionElementNode : document.selectNodes(xpath)) {
            var trainDetectionElement = (Element) trainDetectionElementNode;
            // locate the track netElement the detector is on
            var id = trainDetectionElement.attributeValue("id");

            // parse the location, which should only reference a single element
            var location = SpotLocation.parseSingle(netElements, trainDetectionElement);
            if (location == null)
                throw new InvalidInfraException(String.format("missing spotLocation on trainDetectionElement %s", id));

            // TODO: support directional train detection elements
            if (location.appliesTo != ApplicableDirection.BOTH)
                RailMLParser.logger.warn("directional train detection elements aren't supported, ignoring direction");

            // add the buffer stop to the RJSTrackSection
            var rjsTrackSection = rjsTrackSections.get(location.netElement.id);
            rjsTrackSection.routeWaypoints.add(new RJSTrainDetector(id, ApplicableDirection.BOTH, location.position));
        }
    }
}
