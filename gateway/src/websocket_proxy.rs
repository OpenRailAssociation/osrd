use actix::{io::SinkWrite, Actor, ActorContext, AsyncContext, StreamHandler};
use actix_codec::{AsyncRead, AsyncWrite, Framed};
use actix_web_actors::ws;
use awc::{
    error::WsProtocolError,
    ws::{Codec, Frame},
};
use futures::stream::{SplitSink, SplitStream};

pub struct ClientProxyActor<T: AsyncRead + AsyncWrite> {
    back_tx: Option<SplitSink<Framed<T, Codec>, ws::Message>>,
    back_rx: Option<SplitStream<Framed<T, Codec>>>,
    tx_buffer: Option<SinkWrite<ws::Message, SplitSink<Framed<T, Codec>, ws::Message>>>,
}

impl<T: AsyncRead + AsyncWrite> ClientProxyActor<T> {
    pub fn new(
        rx: SplitStream<Framed<T, Codec>>,
        tx: SplitSink<Framed<T, Codec>, ws::Message>,
    ) -> Self {
        Self {
            back_tx: Some(tx), tx_buffer: None, back_rx: Some(rx)
        }
    }
}

impl<T: AsyncRead + AsyncWrite> Drop for ClientProxyActor<T> {
    fn drop(&mut self) {
        log::debug!("WS: dropped actor")
    }
}

impl<T> Actor for ClientProxyActor<T>
where
    T: AsyncRead + AsyncWrite + 'static,
{
    type Context = ws::WebsocketContext<Self>;

    fn started(&mut self, ctx: &mut Self::Context) {
        let stream = self.back_rx.take().unwrap();
        let sink = self.back_tx.take().unwrap();
        self.tx_buffer = Some(SinkWrite::new(sink, ctx));
        ctx.add_stream(stream);
    }
}

impl<T> StreamHandler<Result<ws::Message, ws::ProtocolError>> for ClientProxyActor<T>
where
    T: AsyncRead + AsyncWrite + 'static,
{
    fn handle(&mut self, msg: Result<ws::Message, ws::ProtocolError>, _: &mut Self::Context) {
        log::info!("received client message: {msg:?}");
        self.tx_buffer.as_mut().map(|s| s.write(msg.unwrap()).unwrap());
    }

    fn started(&mut self, _ctx: &mut Self::Context) {
        log::info!("Connected client stream handler");
    }

    fn finished(&mut self, ctx: &mut Self::Context) {
        log::info!("Client disconnected");
        ctx.stop()
    }
}

impl<T> StreamHandler<Result<Frame, ws::ProtocolError>> for ClientProxyActor<T>
where
    T: AsyncRead + AsyncWrite + 'static,
{
    fn handle(&mut self, msg: Result<Frame, ws::ProtocolError>, ctx: &mut Self::Context) {
        log::info!("received server message: {msg:?}");
        let msg = match msg {
            Ok(m) => m,
            Err(err) => {
                log::error!("ws protocol error: {}", err);
                return;
            }
        };

        let message: ws::Message = match msg {
            Frame::Text(data) => ws::Message::Text(match bytestring::ByteString::try_from(data) {
                Ok(text) => text,
                Err(err) => {
                    log::error!("invalid utf-8 encoding: {}", err);
                    return;
                }
            }),
            Frame::Binary(bin) => ws::Message::Binary(bin),
            Frame::Continuation(cont) => ws::Message::Continuation(cont),
            Frame::Ping(data) => ws::Message::Ping(data),
            Frame::Pong(data) => ws::Message::Pong(data),
            Frame::Close(reason) => ws::Message::Close(reason),
        };

        ctx.write_raw(message);
    }

    fn started(&mut self, _ctx: &mut Self::Context) {
        log::info!("Connected server stream handler");
    }

    fn finished(&mut self, ctx: &mut Self::Context) {
        log::info!("Server disconnected");
        ctx.stop()
    }
}

impl<T> actix::io::WriteHandler<WsProtocolError> for ClientProxyActor<T> where
    T: AsyncRead + AsyncWrite + 'static
{
}
