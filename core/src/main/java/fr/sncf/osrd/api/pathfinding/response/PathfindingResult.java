package fr.sncf.osrd.api.pathfinding.response;

import com.squareup.moshi.Json;
import com.squareup.moshi.JsonAdapter;
import com.squareup.moshi.Moshi;
import fr.sncf.osrd.railjson.schema.common.ID;
import fr.sncf.osrd.railjson.schema.geom.RJSLineString;
import fr.sncf.osrd.railjson.schema.infra.RJSRoutePath;
import fr.sncf.osrd.reporting.warnings.Warning;
import java.util.*;

public class PathfindingResult {
    public static final JsonAdapter<PathfindingResult> adapterResult = new Moshi
            .Builder()
            .add(ID.Adapter.FACTORY)
            .build()
            .adapter(PathfindingResult.class)
            .failOnUnknown();
    @Json(name = "route_paths")
    public List<RJSRoutePath> routePaths = new ArrayList<>();
    @Json(name = "path_waypoints")
    public List<PathWaypointResult> pathWaypoints = new ArrayList<>();

    public final double length;

    public RJSLineString geographic = null;
    public RJSLineString schematic = null;

    public List<SlopeChartPointResult> slopes = new ArrayList<>();
    public List<CurveChartPointResult> curves = new ArrayList<>();

    public List<Warning> warnings = null;

    public PathfindingResult(double length) {
        this.length = length;
    }
}
