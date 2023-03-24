package fr.sncf.osrd.utils;

import fr.sncf.osrd.infra_state.api.TrainPath;
import fr.sncf.osrd.standalone_sim.result.ResultOccupancyTiming;
import fr.sncf.osrd.utils.jacoco.ExcludeFromGeneratedCodeCoverage;
import java.io.*;
import java.nio.charset.StandardCharsets;
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
                        t.timeTailFree
                ));
            }
        } catch (IOException e) {
            e.printStackTrace();
        }
    }
}
