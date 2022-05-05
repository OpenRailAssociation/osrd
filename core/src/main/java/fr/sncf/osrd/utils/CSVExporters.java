package fr.sncf.osrd.utils;

import com.google.common.collect.HashMultimap;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra_state.api.TrainPath;
import fr.sncf.osrd.standalone_sim.result.ResultOccupancyTiming;
import fr.sncf.osrd.standalone_sim.result.SignalUpdate;
import fr.sncf.osrd.utils.jacoco.ExcludeFromGeneratedCodeCoverage;
import java.awt.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;

/** Collection of helpers function for debugging: exports data to csv */
@ExcludeFromGeneratedCodeCoverage()
public class CSVExporters {

    /** exports the occupancy times to csv */
    public static void exportOccupancyToCSV(TrainPath trainPath, HashMap<String, ResultOccupancyTiming> times) {
        try (Writer writer = new BufferedWriter(new OutputStreamWriter(
                new FileOutputStream("times.csv"), StandardCharsets.UTF_8))) {
            writer.write("route,offset,length,head_occupy,tail_occupy,head_free,tail_free\n");
            for (var route : trainPath.routePath()) {
                var id = route.element().getInfraRoute().getID();
                var t = times.get(id);
                writer.write(String.format("%s,%f,%f,%f,%f,%f,%f%n",
                        id,
                        route.pathOffset(),
                        route.element().getInfraRoute().getLength(),
                        t.timeHeadOccupy,
                        t.timeTailOccupy,
                        t.timeHeadFree,
                        t.timeTailFree
                ));
            }
        } catch (IOException e) {
            e.printStackTrace();
        }
    }

    /** exports the signal updates to csv */
    public static void exportSignalUpdatesToCSV(TrainPath trainPath, ArrayList<SignalUpdate> updates) {
        var map = HashMultimap.<String, SignalUpdate>create();
        for (var update : updates)
            for (var route : update.routeIDs)
                map.put(route, update);
        try (Writer writer = new BufferedWriter(new OutputStreamWriter(
                new FileOutputStream("signal_updates.csv"), StandardCharsets.UTF_8))) {
            writer.write("route,offset,length,r,g,b,time_start,time_end\n");
            for (var route : trainPath.routePath()) {
                var id = route.element().getInfraRoute().getID();
                var routeUpdates = map.get(id);
                for (var update : routeUpdates) {
                    writer.write(String.format("%s,%s,%s,%s,%s,%s,%s,%s%n",
                            id,
                            route.pathOffset(),
                            route.element().getInfraRoute().getLength(),
                            new Color(update.color).getRed(),
                            new Color(update.color).getGreen(),
                            new Color(update.color).getBlue(),
                            update.timeStart,
                            update.timeEnd
                    ));
                }
            }
        } catch (IOException e) {
            e.printStackTrace();
        }
    }
}
