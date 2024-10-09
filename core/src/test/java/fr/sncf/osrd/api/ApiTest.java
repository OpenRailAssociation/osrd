package fr.sncf.osrd.api;

import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.utils.Helpers;
import java.io.IOException;
import java.nio.file.Files;
import java.util.regex.Pattern;
import okhttp3.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
public class ApiTest {
    public InfraManager infraManager;

    ElectricalProfileSetManager electricalProfileSetManager = null;

    private static OkHttpClient mockHttpClient(String regex) throws IOException {
        final OkHttpClient okHttpClient = mock(OkHttpClient.class);
        final Call remoteCall = mock(Call.class);

        ArgumentCaptor<Request> argument = ArgumentCaptor.forClass(Request.class);
        lenient().when(okHttpClient.newCall(argument.capture())).thenReturn(remoteCall);
        lenient().when(remoteCall.execute()).thenAnswer(invocation -> new Response.Builder()
                .protocol(Protocol.HTTP_1_1)
                .request(argument.getValue())
                .code(200)
                .message("OK")
                .addHeader("x-infra-version", "1")
                .body(ResponseBody.create(
                        parseMockRequest(argument.getValue(), regex), MediaType.get("application/json; charset=utf-8")))
                .build());

        return okHttpClient;
    }

    @SuppressFBWarnings("DCN_NULLPOINTER_EXCEPTION")
    private static String parseMockRequest(Request request, String regex) throws IOException {
        var url = request.url().toString();
        var matcher = Pattern.compile(regex).matcher(url);
        if (matcher.matches()) {
            try {
                var path = matcher.group(1);
                return Files.readString(Helpers.getResourcePath("infras/" + path));
            } catch (IOException e) {
                throw new IOException("Failed to read mock file", e);
            } catch (AssertionError | NullPointerException e) {
                return ""; // If we can't find the file we return an empty string
            }
        }
        throw new RuntimeException("Could not parse the given url");
    }

    /** Setup infra handler mock */
    @BeforeEach
    public void setUp() throws IOException {
        infraManager = new InfraManager("http://test.com/", null, mockHttpClient(".*/infra/(.*)/railjson.*"));
        electricalProfileSetManager = new ElectricalProfileSetManager(
                "http://test.com/", null, mockHttpClient(".*/electrical_profile_set/(.*)/"));
    }
}
