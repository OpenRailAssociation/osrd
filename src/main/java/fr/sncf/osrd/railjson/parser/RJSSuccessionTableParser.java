package fr.sncf.osrd.railjson.parser;

import java.util.ArrayList;

import fr.sncf.osrd.infra.SuccessionTable;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidSuccession;
import fr.sncf.osrd.railjson.schema.successiontable.RJSSuccessionTable;
import fr.sncf.osrd.railjson.parser.exceptions.MissingSuccessionTableField;

public class RJSSuccessionTableParser {

    /** Parses a RailJSON succession table */
    public static SuccessionTable parse(RJSSuccessionTable rjsSuccessionTable) throws InvalidSuccession {
        if (rjsSuccessionTable.switchID == null) {
            throw new MissingSuccessionTableField("switch");
        }

        if (rjsSuccessionTable.table == null) {
            throw new MissingSuccessionTableField("table");
        }

        var table = new ArrayList<String>();
        for (int i = 0; i < rjsSuccessionTable.table.length; i++) {
            table.add(rjsSuccessionTable.table[i]);
        }

        return new SuccessionTable(
            rjsSuccessionTable.switchID,
            table
        );
    }
}
