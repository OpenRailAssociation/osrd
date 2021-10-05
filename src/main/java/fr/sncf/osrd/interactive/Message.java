package fr.sncf.osrd.interactive;

import com.squareup.moshi.JsonAdapter;
import com.squareup.moshi.Moshi;

public class Message {
    public static final JsonAdapter<Message> adapter = new Moshi.Builder().build().adapter(Message.class);
    public String from = null;
    public String to = null;
    public String content = null;
}
