package fr.sncf.osrd.railjson.schema.geom;

import java.util.ArrayList;
import java.util.List;

public class RJSLineString {

    public String type;

    public List<List<Double>> coordinates;

    public RJSLineString(String type, List<List<Double>> coordinates) {
        this.type = type;
        this.coordinates = coordinates;
    }

    /** Instantiates a line string from xs and ys coordinates */
    public static RJSLineString make(List<Double> xs, List<Double> ys) {
        assert (xs.size() == ys.size());
        var res = new ArrayList<List<Double>>();
        for (int i = 0; i < xs.size(); i++) {
            res.add(List.of(xs.get(i), ys.get(i)));
        }
        return new RJSLineString("LineString", res);
    }
}
