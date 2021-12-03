package fr.sncf.osrd.railml;

import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.infra.SpeedSection;
import fr.sncf.osrd.railjson.schema.common.ID;
import fr.sncf.osrd.railjson.schema.infra.RJSTrackSection;
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSSpeedSection;
import fr.sncf.osrd.railml.tracksectiongraph.NetElement;
import org.dom4j.Document;
import org.dom4j.Element;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;

public final class RMLSpeedSection {
    static final Logger logger = LoggerFactory.getLogger(SpeedSection.class);

    private static fr.sncf.osrd.railjson.schema.infra.RJSSpeedSection parseSpeedLimit(Element element) {
        // parse the speed, and convert to from km/h to m/s
        double speed = Double.parseDouble(element.attributeValue("maxSpeed")) / 3.6;

        // whether there are static signals warning about this limit
        var isSignalized = Boolean.parseBoolean(element.attributeValue("isSignalized"));

        return new fr.sncf.osrd.railjson.schema.infra.RJSSpeedSection(element.attributeValue("id"), isSignalized, speed);
    }

    static ArrayList<fr.sncf.osrd.railjson.schema.infra.RJSSpeedSection> parse(
            Map<String, NetElement> netElementMap,
            Document document,
            HashMap<String, RJSTrackSection> rjsTrackSections
    ) throws InvalidInfraException {
        var res = new ArrayList<fr.sncf.osrd.railjson.schema.infra.RJSSpeedSection>();

        // iterate over all the speed section, which is a continuous set of tracks with a speed limit
        var xpath = "/railML/infrastructure/functionalInfrastructure/speeds/speedSection";
        for (var speedSectionNode : document.selectNodes(xpath)) {
            var speedSectionElement = (Element) speedSectionNode;
            // parse and create the speed limit
            var rjsSpeedLimit = parseSpeedLimit(speedSectionElement);
            logger.trace("created a speed section with speed {}", rjsSpeedLimit.speed);
            res.add(rjsSpeedLimit);
            var speedLimitID = ID.from(rjsSpeedLimit);

            // add the references to the speed limit to track sections
            var hasLinearLocation = LinearLocation.parse(
                    (element, direction, begin, end) -> {
                        var rjsTrackSection = rjsTrackSections.get(element.id);
                        rjsTrackSection.speedSections.add(new RJSSpeedSection(speedLimitID, direction, begin, end));
                    },
                    netElementMap,
                    speedSectionElement
            );

            if (!hasLinearLocation)
                throw new InvalidInfraException("the speed section has no linearLocation");
        }
        return res;
    }
}
