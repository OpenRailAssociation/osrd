package fr.sncf.osrd.cli

import io.opentelemetry.api.trace.Span
import io.opentelemetry.api.trace.SpanKind
import io.opentelemetry.api.trace.StatusCode
import io.opentelemetry.instrumentation.annotations.WithSpan
import org.takes.Request
import org.takes.Response
import org.takes.Take
import org.takes.rq.RqHref
import org.takes.rq.RqMethod
import org.takes.rq.RqRequestLine
import org.takes.rs.RsStatus
import org.takes.tk.TkWrap

class TkOpenTelemetry(take: Take) :
    TkWrap(Take { request: Request -> opentelemetry(take, request) }) {
    companion object {
        @WithSpan(value = "endpoint", kind = SpanKind.SERVER)
        private fun opentelemetry(take: Take, request: Request): Response {
            val span = Span.current()

            val uri = RqRequestLine.Base(request).uri()
            span.updateName(uri)
            span.setAttribute("http.route", uri)
            val method = RqMethod.Base(request).method()
            span.setAttribute("http.request.method", method)
            val path = RqHref.Base(request).href().path()
            span.setAttribute("url.path", path)

            val response = take.act(request)

            val statusCode = RsStatus.Base(response).status()
            span.setAttribute("http.response.status_code", statusCode.toLong())
            if (statusCode < 400) {
                span.setStatus(StatusCode.OK)
            } else {
                span.setStatus(StatusCode.ERROR)
            }

            return response
        }
    }
}
