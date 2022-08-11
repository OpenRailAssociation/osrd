package fr.sncf.osrd.api.stdcm;


import java.util.ArrayList;

public class PathSimulator {
    public static ArrayList<ArrayList<BlockUse>> simulatePaths(
            STDCMConfig config,
            ArrayList<ArrayList<BlockUse>> paths
    ) {
        double Lt = 600; // Longueur train
        double Vc = (float) 160 / 3600; // Vitesse max canton
        double startTime = config.startTime;

        var UPaths = new ArrayList<ArrayList<BlockUse>>();
        for (var path : paths) {
            if (path.get(path.size() - 1).getEntrySig().equals(config.endBlockEntrySig)
                    && path.get(path.size() - 1).getExitSig().equals(config.endBlockExitSig)
                    && path.get(0).getEntrySig().equals(config.startBlockEntrySig)
                    && path.get(0).getExitSig().equals(config.startBlockExitSig)) {
                // if we want to switch to not early, do this instead
                // dateFormat.parse(path.get(path.size() - 1).getTf()).getTime() >= dateFormat.parse(endTime).getTime() && dateFormat.parse(path.get(path.size() - 1).getT()).getTime() < dateFormat.parse(endTime).getTime()) {
                if (path.get(0).reservationEndTime >= startTime && path.get(0).reservationStartTime < startTime)
                    UPaths.add(path);
            }
        }

        var SOL2 = new ArrayList<ArrayList<BlockUse>>();

        double starting = startTime;

        double Tf = 0;
        double Tsr = 0;

        for (int zz = 0; zz < UPaths.size(); zz++) {
            var curPath = UPaths.get(zz);
            double Ts = starting;
            double dtv = 0;
            double pre_speed = 0;

            Ts = Math.max(Ts, curPath.get(0).reservationStartTime);

            SOL2.add(new ArrayList<>());

            for (int i = 0; i < curPath.size() - 2; i++) {
                BlockUse currentB = curPath.get(i);
                BlockUse nextB = curPath.get(i + 1);
                BlockUse nextB2 = curPath.get(i + 2);

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
                    SOL2.get(zz).clear();
                    break;
                }

                SOL2.get(zz).add(new BlockUse(currentB.block, Ts, Tf));

                Ts = Tsn;

                Tsr = Tsrn;
                dtv = dtv_n;
                pre_speed = speed;
            }
        }

        SOL2.removeIf(item -> item.size() == 0);
        return SOL2;
    }

    public static double max_speed(BlockUse current, double Vmat) {
        return Math.min(current.getMaxSpeed(), Vmat);
    }

    public static double calculated_speed(BlockUse current, BlockUse next, double Ts, double Vmat, STDCMConfig config) {
        double V = 0;

        if (next.reservationStartTime > Ts) {
            V = (current.getLength() - config.safetyDistance) / (next.reservationStartTime - Ts);
        } else {
            return max_speed(current, Vmat);
        }
        return Math.min(V, max_speed(current, Vmat));
    }

    public static double T_green(double speed) {
        return 400 / speed;
    }

    public static double T_red(BlockUse current, double Lmat, double V) {
        return current.getLength() / V;
    }

    public static double T_length(double Lmat, double V) {
        return Lmat / V;
    }
}
