package fr.sncf.osrd.envelope;

import fr.sncf.osrd.utils.SwingUtils;
import fr.sncf.osrd.utils.jacoco.ExcludeFromGeneratedCodeCoverage;
import org.math.plot.Plot2DPanel;

import javax.swing.*;
import java.io.IOException;
import java.io.PrintWriter;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Locale;

@ExcludeFromGeneratedCodeCoverage
public class EnvelopeDebug {
    /** Export envelope as csv. */
    public static void saveCSV(Envelope envelope, String path) {
        try {
            PrintWriter writer = new PrintWriter(path, StandardCharsets.UTF_8);
            writer.println("position,speed");
            for (var part : envelope) {
                for (int i = 0; i < part.pointCount(); i++) {
                    writer.println(String.format(Locale.US, "%f,%f", part.getPointPos(i), part.getPointSpeed(i)));
                }
            }
            writer.close();
        } catch (IOException e) {
            e.printStackTrace();
        }
    }

    private static void plotEnvelope(Plot2DPanel plot, Envelope envelope, String envelopeName) {
        // add a line plot to the PlotPanel
        for (int i = 0; i < envelope.size(); i++) {
            var lineName = String.format("%s.parts[%d]", envelopeName, i);
            var part = envelope.get(i);
            var positions = part.clonePositions();
            var speeds = part.cloneSpeeds();
            // workaround https://github.com/yannrichet/jmathplot/issues/5
            if (part.pointCount() == 2) {
                var newPositions = new double[] { positions[0], speeds[0] };
                var newSpeeds = new double[] { positions[1], speeds[1] };
                positions = newPositions;
                speeds = newSpeeds;
            }
            plot.addLinePlot(lineName, positions, speeds);
        }
    }

    /** Creates a plot panel for this envelope */
    public static JPanel plotPanel(Envelope envelope) {
        // create your PlotPanel (you can use it as a JPanel)
        Plot2DPanel plot = new Plot2DPanel();

        // add a line plot to the PlotPanel
        plotEnvelope(plot, envelope, "");

        return plot;
    }

    /** Shows an interactive plot of the envelope */
    public static void plot(Envelope envelope) {
        SwingUtils.debugPanel("Envelope", () -> plotPanel(envelope));
    }

    /** Enables showing multiple envelopes on the same graph:
     * <pre>
     *   EnvelopeDebug.plotBuilder()
     *           .add(doubleCappedEnvelope, "double_capped")
     *           .add(cappedEnvelope, "capped")
     *           .plot();
     * </pre>
     */
    public static PlotBuilder plotBuilder() {
        return new PlotBuilder();
    }

    /** A tool to plot multiple envelopes in the same graph */
    @ExcludeFromGeneratedCodeCoverage
    public static final class PlotBuilder {
        private final ArrayList<Envelope> envelopes = new ArrayList<>();
        private final ArrayList<String> names = new ArrayList<>();

        /** Add an envelope to the plot */
        public PlotBuilder add(Envelope envelope, String name) {
            envelopes.add(envelope);
            names.add(name);
            return this;
        }

        /** Build and show the plot */
        public void plot() {
            SwingUtils.debugPanel("Envelope", () -> {
                var plot = new Plot2DPanel();
                for (int i = 0; i < envelopes.size(); i++)
                    plotEnvelope(plot, envelopes.get(i), names.get(i));
                return plot;
            });
        }
    }
}
