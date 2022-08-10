package fr.sncf.osrd.api.stdcm.Objects;

/** A block occupancy "time span" */
public class BlockUse {

    /**
     * The time at which the block starts to be occupied, which includes the driver lookahead and aspect cascade.
     * By definition equal to Tv.
     */
    private String T;

    /**
     * The time at which the block stops to be occupied, which includes the driver lookahead and aspect cascade.
     * By definition equal to Tfj.
     */
    private String Tf;

    /**
     * Pk of the entry signal.
     */
    private int X;

    /**
     * Pk of the exit signal.
     */
    private int Xf;

    /**
     * The block occupancy identifier. It is a "debug" compound identifier.
     * It contains which GET this block occupancy comes from, as well as the route position in the GET, and more.
     * It cannot be used alone to compare the identity of two block occupancies.
     * The tuple (X, Xf, ID) uniquely identifies block occupancies.
     * The tuple (X, Xf) uniquely identifies blocks.
     * This is not the identifier of the physical block, but rather a compound identifier of the occupancy of the block.
     */
    private String ID;

    /**
     * The length in meters, which is used for physics computations.
     */
    private int L;

     /**
     * The max speed on this block. If it does not make sense, just take the lowest allowed speed in this block.
     */
    private double Vmax;

    public BlockUse(String pT, String pTf, int pX, int pXf, String pID, int pL, double pVmax) {
        T = pT;
        Tf = pTf;
        X = pX;
        Xf = pXf;
        ID = pID;
        L = pL;

        Vmax = pVmax;
     }

    public String getT() {
        return T;
    }

    public String getTf() {
        return Tf;
    }

    public int getX() {
        return X;
    }

    public int getXf() {
        return Xf;
    }

    public String getID() {
        return ID;
    }

    public double getVmax() {
        return Vmax;
    }

    public int getL() {
        return L;
    }



    public void setT(String pT) {
        T = pT;
    }

    public void setTf(String pTf) {
        Tf = pTf;
    }
}
