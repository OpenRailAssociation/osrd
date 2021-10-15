package fr.sncf.osrd.interactive.changes_adapters;

import com.squareup.moshi.Json;
import fr.sncf.osrd.infra_state.InfraState;
import fr.sncf.osrd.infra_state.routes.RouteState;
import fr.sncf.osrd.infra_state.routes.RouteStatus;

public final class SerializedRouteStatus extends SerializedChange {
    @Json(name = "new_status")
    public final RouteStatus newStatus;
    public final String route;

    private SerializedRouteStatus(RouteStatus newStatus, String route) {
        this.newStatus = newStatus;
        this.route = route;
    }

    public static SerializedRouteStatus fromChange(RouteState.RouteStatusChange change, InfraState infraState) {
        var routeName = infraState.getRouteState(change.routeIndex).route.id;
        return new SerializedRouteStatus(change.newStatus, routeName);
    }
}