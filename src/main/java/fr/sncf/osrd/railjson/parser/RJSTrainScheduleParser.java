package fr.sncf.osrd.railjson.parser;

import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.infra.routegraph.Route;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidSchedule;
import fr.sncf.osrd.railjson.parser.exceptions.UnknownRollingStock;
import fr.sncf.osrd.railjson.parser.exceptions.UnknownRoute;
import fr.sncf.osrd.railjson.parser.exceptions.UnknownTrackSection;
import fr.sncf.osrd.railjson.schema.common.RJSTrackLocation;
import fr.sncf.osrd.railjson.schema.schedule.RJSRunningTimeParameters;
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainPhase;
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainSchedule;
import fr.sncf.osrd.RollingStock;
import fr.sncf.osrd.TrainSchedule;
import fr.sncf.osrd.speedcontroller.generators.MaxSpeedGenerator;
import fr.sncf.osrd.speedcontroller.generators.SpeedControllerGenerator;
import fr.sncf.osrd.speedcontroller.generators.MarginGenerator;
import fr.sncf.osrd.train.phases.Phase;
import fr.sncf.osrd.train.phases.SignalNavigatePhase;
import fr.sncf.osrd.train.phases.StopPhase;
import fr.sncf.osrd.utils.TrackSectionLocation;
import fr.sncf.osrd.utils.graph.EdgeDirection;

import java.util.ArrayList;
import java.util.function.Function;

public class RJSTrainScheduleParser {
    /** Parses a RailJSON train schedule */
    public static TrainSchedule parse(
            Infra infra,
            Function<String, RollingStock> rollingStockGetter,
            RJSTrainSchedule rjsTrainSchedule
    ) throws InvalidSchedule {
        var rollingStockID = rjsTrainSchedule.rollingStock.id;
        var rollingStock = rollingStockGetter.apply(rollingStockID);
        if (rollingStock == null)
            throw new UnknownRollingStock(rollingStockID);

        var initialLocation = parseLocation(infra, rjsTrainSchedule.initialHeadLocation);

        var initialRouteID = rjsTrainSchedule.initialRoute.id;
        var initialRoute = infra.routeGraph.routeMap.get(initialRouteID);
        if (initialRoute == null)
            throw new UnknownRoute("unknown initial route", initialRouteID);

        var initialSpeed = rjsTrainSchedule.initialSpeed;
        if (Double.isNaN(initialSpeed) || initialSpeed < 0)
            throw new InvalidSchedule("invalid initial speed");

        // parse the sequence of phases, keeping track of the location of the train between phases
        var phases = new ArrayList<Phase>();
        var beginLocation = initialLocation;
        for (var rjsPhase : rjsTrainSchedule.phases) {
            var phase = parsePhase(infra, beginLocation, rjsPhase);
            var endLocation = phase.getEndLocation();
            if (endLocation != null)
                beginLocation = endLocation;
            phases.add(phase);
        }
        for (var phase : phases)
            phase.resolvePhases(phases);

        // find from what direction the train arrives on the initial location
        EdgeDirection initialDirection = null;
        var tvdSectionPaths = initialRoute.tvdSectionsPaths;
        var tvdSectionPathDirs = initialRoute.tvdSectionsPathDirections;

        trackSectionLoop:
        for (int i = 0; i < tvdSectionPaths.size(); i++) {
            var tvdSectionPath = tvdSectionPaths.get(i);
            var tvdSectionPathDir = tvdSectionPathDirs.get(i);
            for (var trackSectionRange : tvdSectionPath.getTrackSections(tvdSectionPathDir)) {
                if (trackSectionRange.containsLocation(initialLocation)) {
                    initialDirection = trackSectionRange.direction;
                    break trackSectionLoop;
                }
            }
        }

        if (initialDirection == null)
            throw new InvalidSchedule("the initial location isn't on the initial route");

        return new TrainSchedule(
                rjsTrainSchedule.id,
                rollingStock,
                rjsTrainSchedule.departureTime,
                initialLocation,
                initialDirection,
                initialRoute,
                initialSpeed,
                phases
        );
    }

    private static SpeedControllerGenerator parseSpeedControllerGenerator(RJSRunningTimeParameters parameters)
            throws InvalidSchedule {
        if (parameters == null)
            return new MaxSpeedGenerator();
        else if (parameters instanceof RJSRunningTimeParameters.Margin) {
            var typicalParameters = (RJSRunningTimeParameters.Margin) parameters;
            return new MarginGenerator(typicalParameters.marginValue, typicalParameters.marginType);
        } else {
            throw new InvalidSchedule("Unimplemented running type");
        }
    }

    private static Phase parsePhase(
            Infra infra,
            TrackSectionLocation startLocation,
            RJSTrainPhase rjsPhase
    ) throws InvalidSchedule {

        var targetSpeedGenerator = parseSpeedControllerGenerator(rjsPhase.runningTimeParameters);

        if (rjsPhase.getClass() == RJSTrainPhase.Stop.class) {
            var rjsStop = (RJSTrainPhase.Stop) rjsPhase;
            return new StopPhase(rjsStop.duration, targetSpeedGenerator);
        }
        if (rjsPhase.getClass() == RJSTrainPhase.Navigate.class) {
            var rjsNavigate = (RJSTrainPhase.Navigate) rjsPhase;
            var routes = new ArrayList<Route>();
            for (var rjsRoute : rjsNavigate.routes) {
                var route = infra.routeGraph.routeMap.get(rjsRoute.id);
                if (route == null)
                    throw new UnknownRoute("unknown route in navigate phase", rjsRoute.id);
                routes.add(route);
            }

            var driverSightDistance = rjsNavigate.driverSightDistance;
            if (Double.isNaN(driverSightDistance) || driverSightDistance < 0)
                throw new InvalidSchedule("invalid driver sight distance");

            var endLocation = parseLocation(infra, rjsNavigate.endLocation);
            return SignalNavigatePhase.from(routes, driverSightDistance, startLocation,
                    endLocation, targetSpeedGenerator);
        }
        throw new RuntimeException("unknown train phase");
    }

    private static TrackSectionLocation parseLocation(Infra infra, RJSTrackLocation location) throws InvalidSchedule {
        var trackSectionID = location.trackSection.id;
        var trackSection = infra.trackGraph.trackSectionMap.get(trackSectionID);
        if (trackSection == null)
            throw new UnknownTrackSection("unknown section", trackSectionID);
        var offset = location.offset;
        if (offset < 0 || offset > trackSection.length)
            throw new InvalidSchedule("invalid track section offset");
        return new TrackSectionLocation(trackSection, offset);
    }
}
