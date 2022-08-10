package fr.sncf.osrd.api.stdcm.LMP_algo;


import fr.sncf.osrd.api.stdcm.Objects.BlockUse;

import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.ArrayList;

public class DCM_paths {
 public ArrayList<ArrayList<BlockUse>> DCM_paths(ArrayList<ArrayList<BlockUse>> paths) throws ParseException {

     //data
     double Lc = 50; // Longueur canton
     double Lt= 600; // Longueur train
     double Ds=400; // Safety distance 400m
     double Vc=(float)160/3600; // Vitesse max canton
     String Lh="23:59:59"; //Last hour
     double Cm=1;//"01:00:00"; // Chevauchement mini
     double Tm=0;//"03:00:00"; // Temps mini par canton
     int lim=8600;
     double Safety_distance = 400;
     int Xs=72;
     int Xfs=73;
     int Xe=90;
     int Xfe=91;
     String endTime="10:00:00";
     String startTime="06:25:00";
     double MaxTime=3*3.6*Math.pow(10,6);
     //

    // E2J J=new E2J();
     SimpleDateFormat dateFormat = new SimpleDateFormat("HH:mm:ss");

     Boolean early_mode=true;


    ArrayList<ArrayList<BlockUse>> UPaths = new ArrayList<ArrayList<BlockUse>>();
			for (int zz=0;zz<paths.size();zz++) {
        if(paths.get(zz).get(paths.get(zz).size()-1).getX()==Xe&&paths.get(zz).get(paths.get(zz).size()-1).getXf()==Xfe&&paths.get(zz).get(0).getX()==Xs&&paths.get(zz).get(0).getXf()==Xfs) {

            if(!early_mode) {
                if (dateFormat.parse(paths.get(zz).get(paths.get(zz).size() - 1).getTf()).getTime() >= dateFormat.parse(endTime).getTime() && dateFormat.parse(paths.get(zz).get(paths.get(zz).size() - 1).getT()).getTime() < dateFormat.parse(endTime).getTime()) {

                    UPaths.add(paths.get(zz));
                }
            }else{
                if(dateFormat.parse(paths.get(zz).get(0).getTf()).getTime() >= dateFormat.parse(startTime).getTime() && dateFormat.parse(paths.get(zz).get(0).getT()).getTime() < dateFormat.parse(startTime).getTime())
                    UPaths.add(paths.get(zz));
            }
        }
    }
        /*for (int zz=0;zz<UPaths.size();zz++) {

                for(int i=0;i<UPaths.get(zz).size();i++) {

                    System.out.print("["+UPaths.get(zz).get(i).getT()+","+UPaths.get(zz).get(i).getTf()+","+UPaths.get(zz).get(i).getX()+","+UPaths.get(zz).get(i).getXf()+","+UPaths.get(zz).get(i).getID()+","+UPaths.get(zz).get(i).getL()+"]");

                }
                System.out.println();
        }*/

		//J.E2J(UPaths,"U_Paths");



         ArrayList<ArrayList<BlockUse>> SOL2 = new ArrayList<ArrayList<BlockUse>>();


    double Tv=0;
    double Tfv=0;
    double Tr=0;
    double Tfr=0;
    double Tj=0;
    double Tfj=0;

    String starting= startTime;

    double Tf=0;
    double Tsr=0;
    double Tsrn=0;
    double Tsn=0;

		for (int zz=0;zz<UPaths.size();zz++)

        {

            double Ts = dateFormat.parse(starting).getTime();
            double dtv = 0;
            double dtr = 0;
            double dtj = 0;
            double dtv_n = 0;
            double dtr_n = 0;
            double speed = 0;
            double speed_n = 0;
            double pre_speed = 0;

            Ts = Math.max(Ts, dateFormat.parse(UPaths.get(zz).get(0).getT()).getTime());

            SOL2.add(new ArrayList<BlockUse>());

            for (int i = 0; i < UPaths.get(zz).size() - 2; i++) {

                dtr = 0;
                dtj = 0;

                BlockUse currentB = UPaths.get(zz).get(i);
                BlockUse nextB = UPaths.get(zz).get(i + 1);
                BlockUse nextB2 = UPaths.get(zz).get(i + 2);

                if (i == 0)
                    Tsr = Ts;

                //crrent speed
                speed = calculated_speed(currentB, nextB, Tsr, Vc, Safety_distance);
                //current block occupation time
                if (i == 0)
                    dtr = T_red(currentB, Lt, speed);
                else
                    dtr = T_red(currentB, Lt, speed) + T_length(nextB, Lt, pre_speed);

                //safty time to the next block
                dtv_n = T_green(currentB, speed);
                //starting allocation time in the next block
                Tsn = Ts + dtv + (currentB.getL() - Safety_distance) / speed;
                //starting occupation time in the next block
                Tsrn = Tsn + dtv_n;
                //next block speed
                speed_n = calculated_speed(nextB, nextB2, Tsrn, Vc, Safety_distance); // over speed estimation!!!!
                //next block occupation time
                dtr_n = T_red(nextB, Lt, speed_n) + T_length(nextB, Lt, speed);
                //current block free time allocation
                dtj = dtr_n;
                //dtj=T_red(nextB,Lt,speed_n);
                //dtj=T_yellow(dtr_n,Lt,speed);

                //current block final allocation time
                if (i == 0)
                    Tf = Ts + dtv + dtr + dtj;
                else
                    Tf = Tf + dtj;

                //Tf=Ts+(Tf-Ts)*1.25;

                if (Tf > dateFormat.parse(currentB.getTf()).getTime()) {
                    /*System.out.println();
                    System.out.println("Over time: " + Tf + "//" + dateFormat.parse(currentB.getTf()).getTime() + "//i=" + i + "//Get=" + zz);
                    System.out.println();*/
                    SOL2.get(zz).clear();
                    break;
                }

                //System.out.println("check i/zz: "+i+"/"+zz);
                Tv = Ts;
                Tfv = Tv + dtv;

                Tr = Tfv;
                Tfr = Tr + dtr;

                Tj = Tfr;
                Tfj = Tfr + dtj;

                SOL2.get(zz).add(new BlockUse(dateFormat.format(Ts), dateFormat.format(Tf), UPaths.get(zz).get(i).getX(), UPaths.get(zz).get(i).getXf(), UPaths.get(zz).get(i).getID(), UPaths.get(zz).get(i).getL(),  speed * 3600 / 1000));

                Ts = Tsn;

                Tsr = Tsrn;
                dtv = dtv_n;
                pre_speed = speed;

            }
        }

     SOL2.removeIf(item -> item.size()==0 );



     //J.E2J(SOL2,"solution_2");
        return SOL2;
    }

    public static double max_speed(BlockUse current, double Vmat){
        return Math.min(current.getVmax(),Vmat);
    }

    public static double calculated_speed(BlockUse current, BlockUse next, double Ts, double Vmat, double safety_distance) throws ParseException {
        SimpleDateFormat dateFormat = new SimpleDateFormat("HH:mm:ss");
        double V=0;

        if(dateFormat.parse(next.getT()).getTime()>Ts) {
            V = (current.getL() - safety_distance) / (dateFormat.parse(next.getT()).getTime() - Ts);
        }else{
            return max_speed(current,Vmat);
        }
        return Math.min(V,max_speed(current,Vmat));
    }

    public static double T_green(BlockUse current, double speed) throws ParseException {
        double dt=0;
        dt= 400/speed;
        return dt;
    }

    public static double T_green_first(BlockUse current, BlockUse next, String Ts, int Ds, Boolean first, int Vmat) throws ParseException {
        double dt=0;
        dt= current.getL()/max_speed(current,Vmat);
        return dt;
    }

    public static double T_red(BlockUse current, double Lmat, double V){
         double dt = current.getL()/V;
        return dt;
    }

    public static double T_length(BlockUse current, double Lmat, double V){
        double dt =Lmat/V;
        return dt;
    }

    public static double T_yellow(double dtr_n, double Lmat, double speed){
        double dt=dtr_n-Lmat/speed;
        return dt;
    }

    public static double T_yellow_first(BlockUse current){
        double dt=0;
        return dt;
    }

}
