package fr.sncf.osrd.railml;

import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.railjson.schema.common.ID;
import fr.sncf.osrd.railjson.schema.infra.railscript.RJSRSExpr;
import fr.sncf.osrd.railjson.schema.infra.signaling.RJSAspect;
import fr.sncf.osrd.railjson.schema.infra.trackobjects.RJSSignal;
import fr.sncf.osrd.utils.graph.ApplicableDirection;
import org.dom4j.Document;
import org.dom4j.Element;
import java.util.HashMap;

public class RMLSignalIL {
    static void parse(
            Document document,
            HashMap<String, RMLSignalIS> rmlSignalsIS
    ) throws InvalidInfraException {
        var xpath = "/railML/interlocking/assetsForIL/signalsIL/signalIL";
        for (var signalNode : document.selectNodes(xpath)) {
            var signal = (Element) signalNode;
            // locate the track netElement the signal is on
            var id = signal.attributeValue("id");

            double sightDistance = Double.MAX_VALUE;
            var sightDistanceStr = signal.attributeValue("sightDistance");
            if (sightDistanceStr != null)
                sightDistance = Double.parseDouble(sightDistanceStr);

            var refSignalIS = signal.element("refersTo").attributeValue("ref");

            // TODO: parse signal functions and create AST expr
            var aspect = new ID<RJSAspect>("GREEN");
            var greenAspectSetMember = new RJSRSExpr.AspectSet.AspectSetMember(aspect, null);
            var expr = new RJSRSExpr.AspectSet(new RJSRSExpr.AspectSet.AspectSetMember[]{greenAspectSetMember});

            // add the signal to the RJSTrackSection
            var rmlSignalIS = rmlSignalsIS.get(refSignalIS);
            var rjsTrackSection = rmlSignalIS.rjsTrackSection;

            var navigability = rmlSignalIS.navigability;
            if (navigability == null || navigability == ApplicableDirection.BOTH)
                throw new InvalidInfraException(String.format("signal %s doesn't have valid navigability"));

            rjsTrackSection.signals.add(new RJSSignal(
                    id, navigability, rmlSignalIS.position, sightDistance, expr));
        }
    }
}
