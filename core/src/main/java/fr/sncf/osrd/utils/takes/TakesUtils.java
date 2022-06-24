package fr.sncf.osrd.utils.takes;

import org.takes.Response;
import org.takes.rs.RsPrint;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

public class TakesUtils {
    /** Read a `takes` body response and returns it as a String */
    public static String readBodyResponse(Response res) throws IOException {
        return new String(new RsPrint(res).body().readAllBytes(), StandardCharsets.UTF_8);
    }

    /** Read a `takes` header response and returns it as a list of String */
    public static List<String> readHeadResponse(Response res) throws IOException {
        var header = new ArrayList<String>();
        for (var head : res.head()) {
            header.add(head);
        }
        return header;
    }
}
