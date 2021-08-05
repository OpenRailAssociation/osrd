package fr.sncf.osrd.railjson.parser;

import java.util.ArrayList;
import fr.sncf.osrd.infra.SuccessionTable;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidSuccession;
import fr.sncf.osrd.railjson.schema.RJSSuccessions;

public class RJSSuccessionsParser {
    /** Parse the description of a switch succession tables */
    public static ArrayList<SuccessionTable> parse(
            RJSSuccessions rjsSuccession
    ) throws InvalidSuccession {
        var switchSuccession = new ArrayList<SuccessionTable>();
        for (var rjsSuccessionTable : rjsSuccession.successionTables) {
            var successionTable = RJSSuccessionTableParser.parse(rjsSuccessionTable);
            switchSuccession.add(successionTable);
        }
        return switchSuccession;
    }
}