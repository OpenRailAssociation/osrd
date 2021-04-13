package fr.sncf.osrd.railml;

import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.railjson.schema.infra.RJSSwitch;
import org.dom4j.Document;
import org.dom4j.Element;

import java.util.ArrayList;
import java.util.HashMap;

// https://wiki3.railml.org/index.php?title=IL:switchIL
public class RMLSwitchIL {

    static void parse(
            Document document,
            ArrayList<RJSSwitch> switches
    ) throws InvalidInfraException {

        var switch_per_id = new HashMap<String, RJSSwitch>();
        for (var s : switches) {
            switch_per_id.put(s.id, s);
        }

        var xpath = "/railML/interlocking/assetsForIL/switchesIL/switchIL";
        for (var switchNode : document.selectNodes(xpath)) {
            var switchIL = (Element) switchNode;
            var throwTime_iso8601 = switchIL.attributeValue("typicalThrowTime", "PT0S");
            var throwTime = java.time.Duration.parse(throwTime_iso8601).toMillis();
            var id = switchIL.attributeValue("id");
            var switchIS = switch_per_id.get(id);
            if (switchIS == null)
                throw new InvalidInfraException(String.format("Invalid XML, switchIL %s has no matching switchIS", id));
            switchIS.position_change_delay = throwTime;
        }
    }
}
