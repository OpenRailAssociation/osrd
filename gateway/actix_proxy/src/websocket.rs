use actix::{
    Actor, ActorContext, AsyncContext, StreamHandler,
    io::{SinkWrite, WriteHandler},
};
use actix_web::web::{self, Bytes};
use actix_web_actors::ws;
use bytestring::ByteString;
use futures_util::{Sink, Stream};

/// The type of items received from upstream
type UpstreamRxItem = Result<ws::Frame, ws::ProtocolError>;
/// The type of items sent to upstream
type UpstreamTxItem = ws::Message;
/// The type of upstream sink write errors
type UpstreamTxError = ws::ProtocolError;

/// The type of items received from the client
type ClientRxItem = Result<ws::Message, ws::ProtocolError>;

/// An actix actor which performs two-way proxying between an upstream and a client.
pub struct ClientProxyActor<UpTx, UpRx>
where
    UpTx: Sink<UpstreamTxItem, Error = UpstreamTxError> + Unpin + 'static,
    UpRx: Stream<Item = UpstreamRxItem> + Unpin + 'static,
{
    /// The upstream reader and writer are used at actor startup to setup the
    /// tx_writer sink and the StreamHandler<UpstreamRxItem>
    init_params: Option<(UpRx, UpTx)>,
    /// The tx_writer is a sink integrated with actix
    tx_writer: Option<SinkWrite<ws::Message, UpTx>>,
}

impl<UpTx, UpRx> ClientProxyActor<UpTx, UpRx>
where
    UpTx: Sink<UpstreamTxItem, Error = UpstreamTxError> + Unpin + 'static,
    UpRx: Stream<Item = UpstreamRxItem> + Unpin + 'static,
{
    /// Create a new proxy actor, which performs two-way proxying between
    /// a WebsocketContext's client and an upstream connection.
    pub fn new_actor(rx: UpRx, tx: UpTx) -> Self {
        Self {
            init_params: Some((rx, tx)),
            tx_writer: None,
        }
    }

    /// Creates an actor alongsidee a stream
    pub fn new_stream(
        payload: web::Payload,
        rx: UpRx,
        tx: UpTx,
    ) -> impl Stream<Item = Result<Bytes, actix_web::Error>> {
        ws::WebsocketContext::create(Self::new_actor(rx, tx), payload)
    }
}

impl<UpTx, UpRx> Actor for ClientProxyActor<UpTx, UpRx>
where
    UpTx: Sink<UpstreamTxItem, Error = UpstreamTxError> + Unpin + 'static,
    UpRx: Stream<Item = UpstreamRxItem> + Unpin + 'static,
{
    type Context = ws::WebsocketContext<Self>;

    fn started(&mut self, ctx: &mut Self::Context) {
        let (stream, sink) = self.init_params.take().unwrap();
        self.tx_writer = Some(SinkWrite::new(sink, ctx));
        ctx.add_stream(stream);
    }

    fn stopped(&mut self, _: &mut Self::Context) {
        log::debug!("stopped client actor")
    }
}

impl<UpTx, UpRx> StreamHandler<ClientRxItem> for ClientProxyActor<UpTx, UpRx>
where
    UpTx: Sink<UpstreamTxItem, Error = UpstreamTxError> + Unpin + 'static,
    UpRx: Stream<Item = UpstreamRxItem> + Unpin + 'static,
{
    fn handle(&mut self, msg: ClientRxItem, _: &mut Self::Context) {
        log::trace!("client message: {msg:?}");
        let msg = match msg {
            Err(err) => {
                log::warn!("client protocol error: {err}");
                return;
            }
            Ok(msg) => msg,
        };

        log::debug!("received client message: {msg:?}");
        let tx_buffer = match self.tx_writer.as_mut() {
            None => {
                log::warn!("received a client message, but the server sink is not initialized");
                return;
            }
            Some(tx_buffer) => tx_buffer,
        };

        if tx_buffer.write(msg).is_err() {
            log::warn!("received a client message as the server sink is closing");
        }
    }

    fn started(&mut self, _ctx: &mut Self::Context) {
        log::debug!("connected client stream handler");
    }

    fn finished(&mut self, ctx: &mut Self::Context) {
        log::debug!("client disconnected");
        ctx.stop()
    }
}

/// Implement the upstream sink write error handler
impl<UpTx, UpRx> WriteHandler<UpstreamTxError> for ClientProxyActor<UpTx, UpRx>
where
    UpTx: Sink<UpstreamTxItem, Error = UpstreamTxError> + Unpin + 'static,
    UpRx: Stream<Item = UpstreamRxItem> + Unpin + 'static,
{
}

impl<UpTx, UpRx> StreamHandler<UpstreamRxItem> for ClientProxyActor<UpTx, UpRx>
where
    UpTx: Sink<UpstreamTxItem, Error = UpstreamTxError> + Unpin + 'static,
    UpRx: Stream<Item = UpstreamRxItem> + Unpin + 'static,
{
    fn handle(&mut self, msg: UpstreamRxItem, ctx: &mut Self::Context) {
        log::trace!("server message: {msg:?}");
        let msg = match msg {
            Ok(m) => m,
            Err(err) => {
                log::warn!("server protocol error: {err}");
                return;
            }
        };

        ctx.write_raw(match msg {
            ws::Frame::Text(data) => ws::Message::Text(match ByteString::try_from(data) {
                Ok(text) => text,
                Err(err) => {
                    log::warn!("server invalid utf-8 encoding: {err}");
                    return;
                }
            }),
            ws::Frame::Binary(bin) => ws::Message::Binary(bin),
            ws::Frame::Continuation(cont) => ws::Message::Continuation(cont),
            ws::Frame::Ping(data) => ws::Message::Ping(data),
            ws::Frame::Pong(data) => ws::Message::Pong(data),
            ws::Frame::Close(reason) => ws::Message::Close(reason),
        });
    }

    fn started(&mut self, _ctx: &mut Self::Context) {
        log::debug!("connected server stream handler");
    }

    fn finished(&mut self, ctx: &mut Self::Context) {
        log::debug!("server disconnected");
        ctx.stop()
    }
}
