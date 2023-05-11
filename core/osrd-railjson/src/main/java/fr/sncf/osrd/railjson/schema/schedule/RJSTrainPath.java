package fr.sncf.osrd.railjson.schema.schedule;

import com.squareup.moshi.Json;
import fr.sncf.osrd.railjson.schema.infra.RJSRoutePath;
import java.util.ArrayList;
import java.util.List;

public class RJSTrainPath {
    /**
     * Full train path as a list of routes
     */
    @Json(name = "route_paths")
    public final List<RJSRoutePath> routePath;

    public RJSTrainPath(List<RJSRoutePath> path) {
        this.routePath = path;
    }

    public RJSTrainPath() {
        this.routePath = new ArrayList<>();
    }
}
