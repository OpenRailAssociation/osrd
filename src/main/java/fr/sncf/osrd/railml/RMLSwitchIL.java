package fr.sncf.osrd.railml;

import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.railjson.schema.infra.RJSSwitch;
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
            var throwTime_iso8601 = switchIL.attributeValue("typicalThrowTime", "PT0S");
            var throwTime = java.time.Duration.parse(throwTime_iso8601).toMillis();
            var id = switchIL.attributeValue("id");
            var switchIS = switchesIS.get(id);
            if (switchIS == null)
                throw new InvalidInfraException(String.format("Invalid XML, switchIL %s has no matching switchIS", id));
            res.add(new RJSSwitch(id, switchIS.base, switchIS.left, switchIS.right, throwTime));
        }
        return res;
    }
}
