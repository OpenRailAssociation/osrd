package fr.sncf.osrd.railml;

import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.railjson.schema.infra.RJSSwitch;
import fr.sncf.osrd.railjson.schema.infra.RJSSwitchType;

import org.dom4j.Document;
import org.dom4j.Element;
import java.util.ArrayList;
import java.util.HashMap;

// https://wiki3.railml.org/index.php?title=IL:switchIL
public class RMLSwitchIL {

    static ArrayList<RJSSwitch> parse(
            Document document,
            HashMap<String, RMLSwitchIS> switchesIS
    ) throws InvalidInfraException {
        var xpath = "/railML/interlocking/assetsForIL/switchesIL/switchIL";
        var res = new ArrayList<RJSSwitch>();
        for (var switchNode : document.selectNodes(xpath)) {
            var switchIL = (Element) switchNode;
            var throwTimeIso8601 = switchIL.attributeValue("typicalThrowTime", "PT0S");
            double throwTime = java.time.Duration.parse(throwTimeIso8601).toMillis();
            double throwTimeSeconds = throwTime / 1000.;
            var id = switchIL.attributeValue("id");
            var refSwitchIS = switchIL.element("refersTo").attributeValue("ref");
            var switchIS = switchesIS.get(refSwitchIS);
            if (switchIS == null)
                throw new InvalidInfraException(
                        String.format("Invalid XML, switchIL %s has no matching switchIS %s", id, refSwitchIS));
            res.add(RJSSwitchType.makeClassic(id, switchIS.base, switchIS.left, switchIS.right, throwTimeSeconds));
        }
        return res;
    }
}
