package fr.sncf.osrd.api.stdcm.LMP_algo;


import fr.sncf.osrd.api.stdcm.Objects.BlockUse;

import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.ArrayList;

public class DCM_paths {
    public static ArrayList<ArrayList<BlockUse>> DCM_paths(STDCMConfig config, ArrayList<ArrayList<BlockUse>> paths) throws ParseException {
        double Lt = 600; // Longueur train
        double Vc = (float) 160 / 3600; // Vitesse max canton
        String Lh = "23:59:59"; //Last hour
        double Cm = 1; //"01:00:00"; // Chevauchement mini
        double Tm = 0; //"03:00:00"; // Temps mini par canton
        int lim = 8600;
        int Xs = 72;
        int Xfs = 73;
        int Xe = 90;
        int Xfe = 91;
        double startTime = config.startTime;

        var UPaths = new ArrayList<ArrayList<BlockUse>>();
        for (var path : paths) {
            if (path.get(path.size() - 1).getX() == Xe && path.get(path.size() - 1).getXf() == Xfe && path.get(0).getX() == Xs && path.get(0).getXf() == Xfs) {
                // if we want to switch to not early, do this instead
                // dateFormat.parse(path.get(path.size() - 1).getTf()).getTime() >= dateFormat.parse(endTime).getTime() && dateFormat.parse(path.get(path.size() - 1).getT()).getTime() < dateFormat.parse(endTime).getTime()) {
                if (path.get(0).getTf() >= startTime && path.get(0).getT() < startTime)
                    UPaths.add(path);
            }
        }

        var SOL2 = new ArrayList<ArrayList<BlockUse>>();

        double starting = startTime;

        double Tf = 0;
        double Tsr = 0;
        double Tsrn = 0;
        double Tsn = 0;

        for (int zz = 0; zz < UPaths.size(); zz++) {
            double Ts = starting;
            double dtv = 0;
            double dtr = 0;
            double dtj = 0;
            double dtv_n = 0;
            double dtr_n = 0;
            double speed = 0;
            double speed_n = 0;
            double pre_speed = 0;

            Ts = Math.max(Ts, UPaths.get(zz).get(0).getT());

            SOL2.add(new ArrayList<>());

            for (int i = 0; i < UPaths.get(zz).size() - 2; i++) {
                BlockUse currentB = UPaths.get(zz).get(i);
                BlockUse nextB = UPaths.get(zz).get(i + 1);
                BlockUse nextB2 = UPaths.get(zz).get(i + 2);

                if (i == 0)
                    Tsr = Ts;

                //crrent speed
                speed = calculated_speed(currentB, nextB, Tsr, Vc, config);
                //current block occupation time
                if (i == 0)
                    dtr = T_red(currentB, Lt, speed);
                else
                    dtr = T_red(currentB, Lt, speed) + T_length(nextB, Lt, pre_speed);

                // safety time to the next block
                dtv_n = T_green(currentB, speed);
                // starting allocation time in the next block
                Tsn = Ts + dtv + (currentB.getL() - config.safetyDistance) / speed;
                // starting occupation time in the next block
                Tsrn = Tsn + dtv_n;
                // next block speed
                speed_n = calculated_speed(nextB, nextB2, Tsrn, Vc, config); // over speed estimation!!!!
                // next block occupation time
                dtr_n = T_red(nextB, Lt, speed_n) + T_length(nextB, Lt, speed);
                // current block free time allocation
                dtj = dtr_n;

                // current block final allocation time
                if (i == 0)
                    Tf = Ts + dtv + dtr + dtj;
                else
                    Tf = Tf + dtj;

                if (Tf > currentB.getTf()) {
                    SOL2.get(zz).clear();
                    break;
                }

                SOL2.get(zz).add(new BlockUse(Ts, Tf, UPaths.get(zz).get(i).getX(), UPaths.get(zz).get(i).getXf(), UPaths.get(zz).get(i).getID(), UPaths.get(zz).get(i).getL(), speed * 3600 / 1000));

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
        return Math.min(current.getVmax(), Vmat);
    }

    public static double calculated_speed(BlockUse current, BlockUse next, double Ts, double Vmat, STDCMConfig config) {
        double V = 0;

        if (next.getT() > Ts) {
            V = (current.getL() - config.safetyDistance) / (next.getT() - Ts);
        } else {
            return max_speed(current, Vmat);
        }
        return Math.min(V, max_speed(current, Vmat));
    }

    public static double T_green(BlockUse current, double speed) {
        double dt = 0;
        dt = 400 / speed;
        return dt;
    }


    public static double T_red(BlockUse current, double Lmat, double V) {
        double dt = current.getL() / V;
        return dt;
    }

    public static double T_length(BlockUse current, double Lmat, double V) {
        double dt = Lmat / V;
        return dt;
    }
}
