package fr.sncf.osrd.railjson.parser;

import fr.sncf.osrd.Helpers;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidRollingStock;
import fr.sncf.osrd.railjson.schema.rollingstock.RJSRollingStock;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Assertions;
import java.io.IOException;

public class TestRJSRollingStockParser {
    @Test
    public void testCorrectParse() throws IOException {
        RJSRollingStock rjsRollingStock = Helpers.getExampleRollingStock("fast_rolling_stock.json");
        RJSRollingStockParser.parse(rjsRollingStock);
    }

    @Test
    public void testWrongMajorVersion() throws IOException {
        RJSRollingStock rjsRollingStock = Helpers.getExampleRollingStock("fast_rolling_stock.json");
        rjsRollingStock.version = "0.0.0";
        Assertions.assertThrows(InvalidRollingStock.class, () -> RJSRollingStockParser.parse(rjsRollingStock));
    }

    @Test
    public void testWrongMinorVersion() throws IOException {
        RJSRollingStock rjsRollingStock = Helpers.getExampleRollingStock("fast_rolling_stock.json");
        rjsRollingStock.version = RJSRollingStock.CURRENT_VERSION.split("\\.")[0] + ".a";
        RJSRollingStockParser.parse(rjsRollingStock);
    }
}
