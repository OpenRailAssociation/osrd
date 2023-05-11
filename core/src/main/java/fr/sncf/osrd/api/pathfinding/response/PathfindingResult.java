package fr.sncf.osrd.api.pathfinding.response;

import com.squareup.moshi.Json;
import com.squareup.moshi.JsonAdapter;
import com.squareup.moshi.Moshi;
import fr.sncf.osrd.railjson.schema.common.ID;
import fr.sncf.osrd.railjson.schema.infra.RJSRoutePath;
import fr.sncf.osrd.reporting.warnings.Warning;
import fr.sncf.osrd.railjson.schema.geom.LineString;
import fr.sncf.osrd.railjson.schema.geom.Point;
import java.util.*;

public class PathfindingResult {
    public static final JsonAdapter<PathfindingResult> adapterResult = new Moshi
            .Builder()
            .add(ID.Adapter.FACTORY)
            .add(LineString.adapter)
            .add(Point.adapter)
            .build()
            .adapter(PathfindingResult.class)
            .failOnUnknown();
    @Json(name = "route_paths")
    public final List<RJSRoutePath> routePaths = new ArrayList<>();
    @Json(name = "path_waypoints")
    public final List<PathWaypointResult> pathWaypoints = new ArrayList<>();

    public LineString geographic = null;
    public LineString schematic = null;

    public List<SlopeChartPointResult> slopes = new ArrayList<>();
    public List<CurveChartPointResult> curves = new ArrayList<>();

    public List<Warning> warnings = null;
}
