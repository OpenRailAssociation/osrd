package fr.sncf.osrd.api.stdcm;


import java.util.ArrayList;
import java.util.List;

public class PathSimulator {
    /** Takes a list of paths with time ranges, and adjusts */
    @SuppressWarnings("LocalVariableName")
    public static ArrayList<List<BlockUse>> simulatePaths(
            STDCMConfig config,
            ArrayList<List<BlockUse>> paths
    ) {
        double Lt = 600; // Longueur train
        double Vc = (float) 160 / 3.6; // Vitesse max canton
        double startTime = config.startTime;

        {
            var filteredPaths = new ArrayList<List<BlockUse>>();
            for (var path : paths) {
                var pathLastBlock = path.get(path.size() - 1);
                if (!config.endSignalingRoutes.contains(pathLastBlock.block.route))
                    continue;

                // skip paths which start being free after the train starts
                if (path.get(0).reservationStartTime >= startTime)
                    continue;

                // skip paths which stop being free before the train starts
                if (path.get(0).reservationEndTime < startTime)
                    continue;

                filteredPaths.add(path);
            }
            paths = filteredPaths;
        }

        var realisticPaths = new ArrayList<List<BlockUse>>();

        double starting = startTime;

        double Tf = 0;
        double Tsr = 0;

        for (var curPath : paths) {
            double Ts = starting;
            double dtv = 0;
            double pre_speed = 0;

            Ts = Math.max(Ts, curPath.get(0).reservationStartTime);

            var curRealisticPath = new ArrayList<BlockUse>();
            realisticPaths.add(curRealisticPath);

            for (int i = 0; i < curPath.size() - 2; i++) {
                var currentB = curPath.get(i);
                var nextB = curPath.get(i + 1);
                var nextB2 = curPath.get(i + 2);

                if (i == 0)
                    Tsr = Ts;

                // current speed
                double speed = calculated_speed(currentB, nextB, Tsr, Vc, config);
                //current block occupation time
                double dtr;
                if (i == 0)
                    dtr = T_red(currentB, Lt, speed);
                else
                    dtr = T_red(currentB, Lt, speed) + T_length(Lt, pre_speed);

                // safety time to the next block
                double dtv_n = T_green(speed);
                // starting allocation time in the next block
                double Tsn = Ts + dtv + (currentB.getLength() - config.safetyDistance) / speed;
                // starting occupation time in the next block
                double Tsrn = Tsn + dtv_n;
                // next block speed
                double speed_n = calculated_speed(nextB, nextB2, Tsrn, Vc, config); // over speed estimation!!!!
                // next block occupation time
                double dtr_n = T_red(nextB, Lt, speed_n) + T_length(Lt, speed);
                // current block free time allocation
                double dtj = dtr_n;

                // current block final allocation time
                if (i == 0)
                    Tf = Ts + dtv + dtr + dtj;
                else
                    Tf = Tf + dtj;

                if (Tf > currentB.reservationEndTime) {
                    curRealisticPath.clear();
                    break;
                }

                curRealisticPath.add(new BlockUse(currentB.block, Ts, Tf));

                Ts = Tsn;

                Tsr = Tsrn;
                dtv = dtv_n;
                pre_speed = speed;
            }
        }

        realisticPaths.removeIf(item -> item.size() == 0);
        return realisticPaths;
    }

    @SuppressWarnings("ParameterName")
    public static double max_speed(BlockUse current, double Vmat) {
        return Math.min(current.getMaxSpeed(), Vmat);
    }

    @SuppressWarnings({"ParameterName", "LocalVariableName", "MissingJavadocMethod"})
    public static double calculated_speed(BlockUse current, BlockUse next, double Ts, double Vmat, STDCMConfig config) {
        double V = 0;

        if (next.reservationStartTime > Ts) {
            V = (current.getLength() - config.safetyDistance) / (next.reservationStartTime - Ts);
        } else {
            return max_speed(current, Vmat);
        }
        return Math.min(V, max_speed(current, Vmat));
    }

    @SuppressWarnings("MethodName")
    public static double T_green(double speed) {
        return 400 / speed;
    }

    @SuppressWarnings({"MethodName", "ParameterName"})
    public static double T_red(BlockUse current, double Lmat, double V) {
        return current.getLength() / V;
    }

    @SuppressWarnings({"MethodName", "ParameterName"})
    public static double T_length(double Lmat, double V) {
        return Lmat / V;
    }
}
