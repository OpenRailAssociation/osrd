package fr.sncf.osrd.infra.railscript;

import static org.junit.jupiter.api.Assertions.assertEquals;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.infra.railscript.value.RSBool;
import fr.sncf.osrd.infra.railscript.value.RSType;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayOutputStream;
import java.io.PrintStream;

@SuppressFBWarnings({"DM_DEFAULT_ENCODING"})
class PrettyPrinterTest {

    @Test
    public void simpleFunction() throws InvalidInfraException {
        var content = new ByteArrayOutputStream();
        var printer = new PrettyPrinter(new PrintStream(content));

        @SuppressWarnings({"unchecked"})
        var body = new RSExpr.OrExpr((RSExpr<RSBool>[]) new RSExpr<?>[]{
                RSExpr.TrueExpr.INSTANCE,
                RSExpr.FalseExpr.INSTANCE
        });
        var fct = new RSFunction<>("function_test", new String[0], new RSType[0], RSType.BOOLEAN, body);

        printer.print(fct);

        var expected = String.join("\n",
                "fn function_test() -> bool {",
                "    (true or false)",
                "}\n"
                );
        assertEquals(expected, content.toString());
    }
}