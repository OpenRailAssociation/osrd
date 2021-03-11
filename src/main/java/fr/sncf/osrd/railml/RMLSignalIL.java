package fr.sncf.osrd.railml;

import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.infra.railjson.schema.ID;
import fr.sncf.osrd.infra.railjson.schema.RJSTrackSection;
import fr.sncf.osrd.infra.railjson.schema.railscript.RJSRSExpr;
import fr.sncf.osrd.infra.railjson.schema.signaling.RJSAspect;
import fr.sncf.osrd.infra.railjson.schema.trackobjects.RJSSignal;
import fr.sncf.osrd.railml.tracksectiongraph.NetElement;
import org.dom4j.Document;
import org.dom4j.Element;

import java.util.HashMap;
import java.util.Map;

public class RMLSignalIL {
    static void parse(
            Map<String, NetElement> netElements,
            Document document,
            HashMap<String, RJSTrackSection> rjsTrackSections,
            HashMap<String, RMLSignalIS> rmlSignalsIS
    ) throws InvalidInfraException {
        var xpath = "/railML/interlocking/assetsForIL/signalsIL/signalIL";
        for (var signalNode : document.selectNodes(xpath)) {
            var signal = (Element) signalNode;
            // locate the track netElement the signal is on
            var id = signal.attributeValue("id");

            var refSignalIS = signal.element("refersTo").attributeValue("ref");

            // TODO: parse signal functions and create AST expr
            var aspect = new RJSAspect("GREEN", "#00FF00");
            var greenAspectSetMember = new RJSRSExpr.AspectSet.AspectSetMember(ID.from(aspect), null);
            var expr = new RJSRSExpr.AspectSet(new RJSRSExpr.AspectSet.AspectSetMember[]{greenAspectSetMember});

            // add the signal to the RJSTrackSection
            var rmlSignalIS = rmlSignalsIS.get(refSignalIS);
            var rjsTrackSection = rmlSignalIS.rjsTrackSection;
            rjsTrackSection.signals.add(new RJSSignal(id, rmlSignalIS.navigability, rmlSignalIS.position, expr));
        }
    }
}
