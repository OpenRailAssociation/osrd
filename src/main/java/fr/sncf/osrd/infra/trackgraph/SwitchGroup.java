package fr.sncf.osrd.infra.trackgraph;

public class SwitchGroup {

    public final String group;

    public SwitchGroup(String group) {
        this.group = group;
    }
    
    @Override
    public int hashCode() {
        return group.hashCode();
    }

    @Override
    public boolean equals(Object g) {
        if (!(g instanceof SwitchGroup))
            return false;
        var ggroup = ((SwitchGroup) g).group;
        if (group == null || ggroup == null)
            return group == null && ggroup == null;
        return group.equals(ggroup);
    }

    @Override
    public String toString() {
        return group;
    }

    public static final SwitchGroup MOVING = new SwitchGroup(null);
}
