package fr.sncf.osrd.railml;

import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.railjson.schema.infra.RJSTrackSection;
import fr.sncf.osrd.railml.tracksectiongraph.NetElement;
import fr.sncf.osrd.utils.graph.ApplicableDirection;
import org.dom4j.Document;
import org.dom4j.Element;

import java.util.HashMap;
import java.util.Map;

public class RMLSignalIS {
    final RJSTrackSection rjsTrackSection;
    final double position;
    final ApplicableDirection navigability;

    private RMLSignalIS(
            RJSTrackSection rjsTrackSection,
            ApplicableDirection navigability,
            double position
    ) {
        this.rjsTrackSection = rjsTrackSection;
        this.navigability = navigability;
        this.position = position;
    }

    static HashMap<String, RMLSignalIS> parse(
            Map<String, NetElement> netElements,
            Document document,
            HashMap<String, RJSTrackSection> rjsTrackSections
    ) throws InvalidInfraException {
        var signals = new HashMap<String, RMLSignalIS>();
        var xpath = "/railML/infrastructure/functionalInfrastructure/signalsIS/signalIS";
        for (var signalNode : document.selectNodes(xpath)) {
            var signal = (Element) signalNode;
            // locate the track netElement the signal is on
            var id = signal.attributeValue("id");

            // parse the location, which should only reference a single element
            var location = SpotLocation.parseSingle(netElements, signal);
            if (location == null)
                throw new InvalidInfraException(String.format("missing spotLocation on signal %s", id));

            var rjsTrackSection = rjsTrackSections.get(location.netElement.id);
            signals.put(id, new RMLSignalIS(rjsTrackSection, location.appliesTo, location.position));
        }
        return signals;
    }
}
