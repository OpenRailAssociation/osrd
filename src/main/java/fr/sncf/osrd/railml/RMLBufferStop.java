package fr.sncf.osrd.railml;

import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.infra.railjson.schema.RJSTrackSection;
import fr.sncf.osrd.infra.railjson.schema.trackobjects.RJSBufferStop;
import fr.sncf.osrd.railml.tracksectiongraph.NetElement;
import org.dom4j.Document;
import org.dom4j.Element;

import java.util.HashMap;
import java.util.Map;

public class RMLBufferStop {
    static void parse(
            Map<String, NetElement> netElements,
            Document document,
            HashMap<String, RJSTrackSection> rjsTrackSections
    ) throws InvalidInfraException {
        var xpath = "/railML/infrastructure/functionalInfrastructure/bufferStops/bufferStop";
        for (var bufferStopNode : document.selectNodes(xpath)) {
            var bufferStop = (Element) bufferStopNode;
            // locate the track netElement the buffer stop is on
            var id = bufferStop.attributeValue("id");

            // parse the location, which should only reference a single element
            var location = SpotLocation.parseSingle(netElements, bufferStop);
            if (location == null)
                throw new InvalidInfraException(String.format("missing spotLocation on bufferStop %s", id));

            // add the buffer stop to the RJSTrackSection
            var rjsTrackSection = rjsTrackSections.get(location.netElement.id);
            rjsTrackSection.routeWaypoints.add(new RJSBufferStop(id, location.appliesTo, location.position));
        }
    }
}
